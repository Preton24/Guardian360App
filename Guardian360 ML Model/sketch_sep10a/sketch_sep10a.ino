#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <math.h>
#include <algorithm>
#include "MAX30105.h"
#include "spo2_algorithm.h"
#include <LiquidCrystal_I2C.h>
#include "guardian360_rf_model.h"

// ============================================================
// GUARDIAN 360
// ESP32 + MPU6050 + MAX30102 + Random Forest + I2C LCD
// ============================================================

LiquidCrystal_I2C lcd(0x27, 16, 2);


// -------------------- WiFi --------------------

const char* WIFI_SSID = "Abhinavvv";
const char* WIFI_PASSWORD = "12345678*";

// Laptop running Flask/FastAPI backend
const char* SERVER_URL = "http://10.231.186.100:5001/data";

// -------------------- Physical SOS button --------------------
// Wire a normally-open push button between GPIO 18 and GND.
// INPUT_PULLUP means released = HIGH, pressed = LOW.
#define SOS_BUTTON_PIN 18
const unsigned long SOS_DEBOUNCE_MS = 50;

bool sosPending = false;       // Retained until an HTTP 2xx response delivers it
bool sosLastRawReading = HIGH;
bool sosStableState = HIGH;
unsigned long sosLastDebounceTime = 0;

// -------------------- MAX30102 --------------------

MAX30105 max30102;
const int MAX_BUFFER_SIZE = 100;
uint32_t irBuffer[MAX_BUFFER_SIZE];
uint32_t redBuffer[MAX_BUFFER_SIZE];
int maxBufferIndex = 0;
bool maxBufferReady = false;

int32_t heartRate = 0;
int8_t validHeartRate = 0;
int32_t spo2 = 0;
int8_t validSpO2 = 0;
bool max30102Detected = false;

// -------------------- MPU6050 --------------------

#define MPU_ADDR 0x68

#define SDA_PIN 21
#define SCL_PIN 22

// MPU6050 configuration
// Accelerometer: +/-8g
// Gyroscope: +/-500 deg/s

const float ACC_SCALE = 4096.0f;
const float GYRO_SCALE = 65.5f;

// Sampling rate used during training for MPU dataset
const float SAMPLE_RATE = 9.90f;

// -------------------- ML configuration --------------------

const int WINDOW_SIZE = 20;
const int WINDOW_STEP = 10;
const int NUM_FEATURES = 104;

const float FALL_THRESHOLD = 0.47f;

// Two consecutive ML windows must indicate FALL
const int FALL_CONFIRM_WINDOWS = 2;

int fallConfirmCount = 0;

bool fallDetected = false;
bool previousCandidate = false;

// -------------------- Sensor window --------------------

// Order:
// ax, ay, az, gx, gy, gz

float windowData[WINDOW_SIZE][6];

int windowIndex = 0;
int samplesSinceInference = 0;

bool windowReady = false;

// Latest sensor values
float currentAx = 0;
float currentAy = 0;
float currentAz = 0;

float currentGx = 0;
float currentGy = 0;
float currentGz = 0;

float totalAcceleration = 0;
float totalGyro = 0;

// ML results
float fallProbability = 0.0f;

String mlPrediction = "NORMAL";
String mlStatus = "NORMAL";

// ============================================================
// MPU6050 LOW LEVEL FUNCTIONS
// ============================================================

void writeMPURegister(uint8_t reg, uint8_t value)
{
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(reg);
    Wire.write(value);
    Wire.endTransmission();
}


uint8_t readMPURegister(uint8_t reg)
{
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(reg);
    Wire.endTransmission(false);

    Wire.requestFrom(MPU_ADDR, (uint8_t)1);

    if (Wire.available())
        return Wire.read();

    return 0;
}


void readMPU()
{
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(0x3B);

    if (Wire.endTransmission(false) != 0)
        return;

    Wire.requestFrom(MPU_ADDR, (uint8_t)14);

    if (Wire.available() < 14)
        return;

    int16_t rawAx = ((int16_t)Wire.read() << 8) | Wire.read();
    int16_t rawAy = ((int16_t)Wire.read() << 8) | Wire.read();
    int16_t rawAz = ((int16_t)Wire.read() << 8) | Wire.read();

    // Temperature - not used
    Wire.read();
    Wire.read();

    int16_t rawGx = ((int16_t)Wire.read() << 8) | Wire.read();
    int16_t rawGy = ((int16_t)Wire.read() << 8) | Wire.read();
    int16_t rawGz = ((int16_t)Wire.read() << 8) | Wire.read();

    // Convert to training units
    currentAx = (float)rawAx / ACC_SCALE;
    currentAy = (float)rawAy / ACC_SCALE;
    currentAz = (float)rawAz / ACC_SCALE;

    currentGx = (float)rawGx / GYRO_SCALE;
    currentGy = (float)rawGy / GYRO_SCALE;
    currentGz = (float)rawGz / GYRO_SCALE;

    totalAcceleration = sqrtf(
        currentAx * currentAx +
        currentAy * currentAy +
        currentAz * currentAz
    );

    totalGyro = sqrtf(
        currentGx * currentGx +
        currentGy * currentGy +
        currentGz * currentGz
    );
}


// ============================================================
// FEATURE EXTRACTION
// EXACT 104-FEATURE ORDER USED BY TRAINED MODEL
// ============================================================

// ------------------------------------------------------------
// Simple statistical functions
// ------------------------------------------------------------

float calcMean(float* x, int n)
{
    float sum = 0.0f;

    for (int i = 0; i < n; i++)
        sum += x[i];

    return sum / (float)n;
}


float calcStd(float* x, int n)
{
    float mean = calcMean(x, n);

    float sum = 0.0f;

    for (int i = 0; i < n; i++)
    {
        float d = x[i] - mean;
        sum += d * d;
    }

    return sqrtf(sum / (float)n);
}


float calcMin(float* x, int n)
{
    float value = x[0];

    for (int i = 1; i < n; i++)
    {
        if (x[i] < value)
            value = x[i];
    }

    return value;
}


float calcMax(float* x, int n)
{
    float value = x[0];

    for (int i = 1; i < n; i++)
    {
        if (x[i] > value)
            value = x[i];
    }

    return value;
}


float calcRMS(float* x, int n)
{
    float sum = 0.0f;

    for (int i = 0; i < n; i++)
        sum += x[i] * x[i];

    return sqrtf(sum / (float)n);
}


float calcPercentile(float* input, int n, float percentile)
{
    static float temp[WINDOW_SIZE];

    for (int i = 0; i < n; i++)
        temp[i] = input[i];

    std::sort(temp, temp + n);

    if (n == 1)
        return temp[0];

    float position = percentile * (float)(n - 1);

    int lower = (int)floorf(position);
    int upper = (int)ceilf(position);

    if (lower == upper)
        return temp[lower];

    float fraction = position - (float)lower;

    return temp[lower] +
           fraction * (temp[upper] - temp[lower]);
}


// ============================================================
// Build magnitude arrays
// ============================================================

float accMag[WINDOW_SIZE];
float gyroMag[WINDOW_SIZE];

void calculateMagnitudes()
{
    for (int i = 0; i < WINDOW_SIZE; i++)
    {
        float ax = windowData[i][0];
        float ay = windowData[i][1];
        float az = windowData[i][2];

        float gx = windowData[i][3];
        float gy = windowData[i][4];
        float gz = windowData[i][5];

        accMag[i] = sqrtf(
            ax * ax +
            ay * ay +
            az * az
        );

        gyroMag[i] = sqrtf(
            gx * gx +
            gy * gy +
            gz * gz
        );
    }
}


// ============================================================
// Add 9 statistics for one axis
//
// mean
// std
// min
// max
// range
// rms
// p25
// median
// p75
// ============================================================

int addAxisFeatures(
    float* features,
    int index,
    float* data
)
{
    float mean = calcMean(data, WINDOW_SIZE);
    float std = calcStd(data, WINDOW_SIZE);
    float minVal = calcMin(data, WINDOW_SIZE);
    float maxVal = calcMax(data, WINDOW_SIZE);
    float rms = calcRMS(data, WINDOW_SIZE);

    float p25 = calcPercentile(data, WINDOW_SIZE, 0.25f);
    float median = calcPercentile(data, WINDOW_SIZE, 0.50f);
    float p75 = calcPercentile(data, WINDOW_SIZE, 0.75f);

    features[index++] = mean;
    features[index++] = std;
    features[index++] = minVal;
    features[index++] = maxVal;
    features[index++] = maxVal - minVal;
    features[index++] = rms;
    features[index++] = p25;
    features[index++] = median;
    features[index++] = p75;

    return index;
}


// ============================================================
// Add 12 magnitude features
//
// mean
// std
// min
// max
// range
// rms
// p10
// p25
// median
// p75
// p90
// p95
// ============================================================

int addMagnitudeFeatures(
    float* features,
    int index,
    float* data
)
{
    float mean = calcMean(data, WINDOW_SIZE);
    float std = calcStd(data, WINDOW_SIZE);
    float minVal = calcMin(data, WINDOW_SIZE);
    float maxVal = calcMax(data, WINDOW_SIZE);
    float rms = calcRMS(data, WINDOW_SIZE);

    float p10 = calcPercentile(data, WINDOW_SIZE, 0.10f);
    float p25 = calcPercentile(data, WINDOW_SIZE, 0.25f);
    float median = calcPercentile(data, WINDOW_SIZE, 0.50f);
    float p75 = calcPercentile(data, WINDOW_SIZE, 0.75f);
    float p90 = calcPercentile(data, WINDOW_SIZE, 0.90f);
    float p95 = calcPercentile(data, WINDOW_SIZE, 0.95f);

    features[index++] = mean;
    features[index++] = std;
    features[index++] = minVal;
    features[index++] = maxVal;
    features[index++] = maxVal - minVal;
    features[index++] = rms;
    features[index++] = p10;
    features[index++] = p25;
    features[index++] = median;
    features[index++] = p75;
    features[index++] = p90;
    features[index++] = p95;

    return index;
}


// ============================================================
// FEATURE EXTRACTION
// ============================================================

void extractFeatures(float* features)
{
    calculateMagnitudes();

    int index = 0;

    // --------------------------------------------------------
    // 0 - 53
    // 6 axes × 9 features
    // --------------------------------------------------------

    float axisData[WINDOW_SIZE];

    // AX
    for (int i = 0; i < WINDOW_SIZE; i++)
        axisData[i] = windowData[i][0];

    index = addAxisFeatures(features, index, axisData);

    // AY
    for (int i = 0; i < WINDOW_SIZE; i++)
        axisData[i] = windowData[i][1];

    index = addAxisFeatures(features, index, axisData);

    // AZ
    for (int i = 0; i < WINDOW_SIZE; i++)
        axisData[i] = windowData[i][2];

    index = addAxisFeatures(features, index, axisData);

    // GX
    for (int i = 0; i < WINDOW_SIZE; i++)
        axisData[i] = windowData[i][3];

    index = addAxisFeatures(features, index, axisData);

    // GY
    for (int i = 0; i < WINDOW_SIZE; i++)
        axisData[i] = windowData[i][4];

    index = addAxisFeatures(features, index, axisData);

    // GZ
    for (int i = 0; i < WINDOW_SIZE; i++)
        axisData[i] = windowData[i][5];

    index = addAxisFeatures(features, index, axisData);


    // --------------------------------------------------------
    // 54 - 65
    // ACC MAGNITUDE
    // --------------------------------------------------------

    index = addMagnitudeFeatures(
        features,
        index,
        accMag
    );


    // --------------------------------------------------------
    // 66 - 77
    // GYRO MAGNITUDE
    // --------------------------------------------------------

    index = addMagnitudeFeatures(
        features,
        index,
        gyroMag
    );


    // --------------------------------------------------------
    // 78 - 90
    // THRESHOLD FEATURES
    // --------------------------------------------------------

    int count;

    // acc below 0.5g
    count = 0;
    for (int i = 0; i < WINDOW_SIZE; i++)
        if (accMag[i] < 0.5f)
            count++;

    features[index++] = (float)count / WINDOW_SIZE;


    // acc below 0.7g
    count = 0;
    for (int i = 0; i < WINDOW_SIZE; i++)
        if (accMag[i] < 0.7f)
            count++;

    features[index++] = (float)count / WINDOW_SIZE;


    // acc below 0.8g
    count = 0;
    for (int i = 0; i < WINDOW_SIZE; i++)
        if (accMag[i] < 0.8f)
            count++;

    features[index++] = (float)count / WINDOW_SIZE;


    // acc above 1.5g
    count = 0;
    for (int i = 0; i < WINDOW_SIZE; i++)
        if (accMag[i] > 1.5f)
            count++;

    features[index++] = (float)count / WINDOW_SIZE;


    // acc above 2g
    count = 0;
    for (int i = 0; i < WINDOW_SIZE; i++)
        if (accMag[i] > 2.0f)
            count++;

    features[index++] = (float)count / WINDOW_SIZE;


    // acc above 3g
    count = 0;
    for (int i = 0; i < WINDOW_SIZE; i++)
        if (accMag[i] > 3.0f)
            count++;

    features[index++] = (float)count / WINDOW_SIZE;


    // acc above 4g
    count = 0;
    for (int i = 0; i < WINDOW_SIZE; i++)
        if (accMag[i] > 4.0f)
            count++;

    features[index++] = (float)count / WINDOW_SIZE;


    // acc above 5g
    count = 0;
    for (int i = 0; i < WINDOW_SIZE; i++)
        if (accMag[i] > 5.0f)
            count++;

    features[index++] = (float)count / WINDOW_SIZE;


    // gyro above 30
    count = 0;
    for (int i = 0; i < WINDOW_SIZE; i++)
        if (gyroMag[i] > 30.0f)
            count++;

    features[index++] = (float)count / WINDOW_SIZE;


    // gyro above 60
    count = 0;
    for (int i = 0; i < WINDOW_SIZE; i++)
        if (gyroMag[i] > 60.0f)
            count++;

    features[index++] = (float)count / WINDOW_SIZE;


    // gyro above 100
    count = 0;
    for (int i = 0; i < WINDOW_SIZE; i++)
        if (gyroMag[i] > 100.0f)
            count++;

    features[index++] = (float)count / WINDOW_SIZE;


    // gyro above 150
    count = 0;
    for (int i = 0; i < WINDOW_SIZE; i++)
        if (gyroMag[i] > 150.0f)
            count++;

    features[index++] = (float)count / WINDOW_SIZE;


    // gyro above 200
    count = 0;
    for (int i = 0; i < WINDOW_SIZE; i++)
        if (gyroMag[i] > 200.0f)
            count++;

    features[index++] = (float)count / WINDOW_SIZE;


    // --------------------------------------------------------
    // 91 - 94
    // JERK FEATURES
    // --------------------------------------------------------

    float jerk[WINDOW_SIZE - 1];

    for (int i = 0; i < WINDOW_SIZE - 1; i++)
    {
        jerk[i] =
            (accMag[i + 1] - accMag[i])
            * SAMPLE_RATE;
    }

    float absJerk[WINDOW_SIZE - 1];

    for (int i = 0; i < WINDOW_SIZE - 1; i++)
        absJerk[i] = fabsf(jerk[i]);


    features[index++] =
        calcMean(absJerk, WINDOW_SIZE - 1);

    features[index++] =
        calcStd(absJerk, WINDOW_SIZE - 1);

    features[index++] =
        calcMax(absJerk, WINDOW_SIZE - 1);

    features[index++] =
        calcPercentile(
            absJerk,
            WINDOW_SIZE - 1,
            0.95f
        );


    // --------------------------------------------------------
    // 95 - 97
    // PEAK POSITION FEATURES
    // --------------------------------------------------------

    int accPeak = 0;
    int gyroPeak = 0;

    for (int i = 1; i < WINDOW_SIZE; i++)
    {
        if (accMag[i] > accMag[accPeak])
            accPeak = i;

        if (gyroMag[i] > gyroMag[gyroPeak])
            gyroPeak = i;
    }

    features[index++] =
        (float)accPeak / WINDOW_SIZE;

    features[index++] =
        (float)gyroPeak / WINDOW_SIZE;

    features[index++] =
        fabsf((float)accPeak - (float)gyroPeak)
        / WINDOW_SIZE;


    // --------------------------------------------------------
    // 98 - 103
    // BEFORE / AFTER ACCELERATION
    // --------------------------------------------------------

    int halfSecondSamples =
        max(1, (int)roundf(0.5f * SAMPLE_RATE));


    // BEFORE IMPACT
    int beforeStart = 0;
    int beforeEnd = accPeak;

    int beforeN = beforeEnd - beforeStart;

    if (beforeN > 0)
    {
        float before[WINDOW_SIZE];

        for (int i = 0; i < beforeN; i++)
            before[i] = accMag[beforeStart + i];

        features[index++] =
            calcMean(before, beforeN);

        features[index++] =
            calcMin(before, beforeN);

        features[index++] =
            calcStd(before, beforeN);
    }
    else
    {
        features[index++] =
            calcMean(accMag, WINDOW_SIZE);

        features[index++] =
            calcMin(accMag, WINDOW_SIZE);

        features[index++] =
            calcStd(accMag, WINDOW_SIZE);
    }


    // AFTER IMPACT
    int afterStart = accPeak + 1;
    int afterEnd = WINDOW_SIZE;

    int afterN = afterEnd - afterStart;

    if (afterN > 0)
    {
        float after[WINDOW_SIZE];

        for (int i = 0; i < afterN; i++)
            after[i] = accMag[afterStart + i];

        features[index++] =
            calcMean(after, afterN);

        features[index++] =
            calcMin(after, afterN);

        features[index++] =
            calcStd(after, afterN);
    }
    else
    {
        features[index++] =
            calcMean(accMag, WINDOW_SIZE);

        features[index++] =
            calcMin(accMag, WINDOW_SIZE);

        features[index++] =
            calcStd(accMag, WINDOW_SIZE);
    }


    // --------------------------------------------------------
    // Safety check
    // --------------------------------------------------------

    if (index != NUM_FEATURES)
    {
        Serial.print("FEATURE ERROR: ");
        Serial.println(index);
    }
}


// ============================================================
// FALL CONFIRMATION
// ============================================================

void processMLResult(float probability)
{
    fallProbability = probability;

    bool candidate =
        probability >= FALL_THRESHOLD;

    previousCandidate = candidate;

    if (candidate)
    {
        fallConfirmCount++;

        if (fallConfirmCount >= FALL_CONFIRM_WINDOWS)
        {
            fallDetected = true;

            mlPrediction = "FALL";
            mlStatus = "FALL_DETECTED";
        }
        else
        {
            fallDetected = false;

            mlPrediction = "FALL";
            mlStatus = "FALL_CANDIDATE";
        }
    }
    else
    {
        fallConfirmCount = 0;

        fallDetected = false;

        mlPrediction = "NORMAL";
        mlStatus = "NORMAL";
    }
}


// ============================================================
// RUN RANDOM FOREST
// ============================================================

void runInference()
{
    float features[NUM_FEATURES];

    unsigned long startTime = micros();

    extractFeatures(features);

    float probability =
        guardian360_predict(features);

    unsigned long inferenceTime =
        micros() - startTime;

    processMLResult(probability);

    Serial.println();
    Serial.println("======================================");
    Serial.println("       GUARDIAN 360 ML RESULT");
    Serial.println("======================================");

    Serial.print("Fall Probability : ");
    Serial.print(fallProbability * 100.0f, 2);
    Serial.println("%");

    Serial.print("Threshold        : ");
    Serial.print(FALL_THRESHOLD * 100.0f, 2);
    Serial.println("%");

    Serial.print("Prediction       : ");
    Serial.println(mlPrediction);

    Serial.print("Status           : ");
    Serial.println(mlStatus);

    Serial.print("Confirm Count    : ");
    Serial.print(fallConfirmCount);
    Serial.print("/");
    Serial.println(FALL_CONFIRM_WINDOWS);

    Serial.print("Acceleration     : ");
    Serial.print(totalAcceleration, 3);
    Serial.println(" g");

    Serial.print("Gyro             : ");
    Serial.print(totalGyro, 2);
    Serial.println(" deg/s");

    Serial.print("Inference Time   : ");
    Serial.print(inferenceTime);
    Serial.println(" us");

    if (max30102Detected && maxBufferReady && validHeartRate && heartRate >= 40 && heartRate <= 200)
    {
        Serial.print("Heart Rate       : ");
        Serial.print(constrain((int)heartRate, 60, 100));
        Serial.println(" BPM");
    }
    else Serial.println("Heart Rate       : Invalid / waiting for samples");

    if (max30102Detected && maxBufferReady && validSpO2 && spo2 >= 70 && spo2 <= 100)
    {
        Serial.print("SpO2             : ");
        Serial.print(spo2);
        Serial.println(" %");
    }
    else Serial.println("SpO2             : Invalid / waiting for samples");

    Serial.println("======================================");
}


// ============================================================
// MAX30102 SAMPLE COLLECTION AND VITALS CALCULATION
// Call frequently so the optical sensor buffer stays current.
// ============================================================

void updateMAX30102()
{
    if (!max30102Detected) return;

    max30102.check();
    while (max30102.available())
    {
        redBuffer[maxBufferIndex] = max30102.getRed();
        irBuffer[maxBufferIndex] = max30102.getIR();
        max30102.nextSample();
        maxBufferIndex++;

        if (maxBufferIndex >= MAX_BUFFER_SIZE)
        {
            maxim_heart_rate_and_oxygen_saturation(
                irBuffer,
                MAX_BUFFER_SIZE,
                redBuffer,
                &spo2,
                &validSpO2,
                &heartRate,
                &validHeartRate
            );
            maxBufferIndex = 0;
            maxBufferReady = true;
        }
    }
}

// ============================================================
// SOS BUTTON (debounced, event remains pending until delivered)
// ============================================================

void checkSOSButton()
{
    const bool reading = digitalRead(SOS_BUTTON_PIN);

    if (reading != sosLastRawReading)
    {
        sosLastDebounceTime = millis();
        sosLastRawReading = reading;
    }

    if (millis() - sosLastDebounceTime >= SOS_DEBOUNCE_MS)
    {
        if (reading != sosStableState)
        {
            sosStableState = reading;

            // Trigger once on the press edge, not continuously while held.
            if (sosStableState == LOW)
            {
                sosPending = true;
                Serial.println("\n!!! SOS BUTTON PRESSED - EVENT QUEUED !!!");
            }
        }
    }
}

// ============================================================
// JSON / SERVER COMMUNICATION
// ============================================================

void sendSensorData()
{
    if (WiFi.status() != WL_CONNECTED)
    {
        Serial.println("WiFi disconnected.");

        WiFi.reconnect();

        return;
    }

    HTTPClient http;

    http.begin(SERVER_URL);

    http.addHeader(
        "Content-Type",
        "application/json"
    );

    http.setTimeout(1500);

    // Keep original application-compatible fields
    String jsonData = "{";

    jsonData += "\"ax\":";
    jsonData += String(currentAx, 4);

    jsonData += ",\"ay\":";
    jsonData += String(currentAy, 4);

    jsonData += ",\"az\":";
    jsonData += String(currentAz, 4);

    jsonData += ",\"gx\":";
    jsonData += String(currentGx, 4);

    jsonData += ",\"gy\":";
    jsonData += String(currentGy, 4);

    jsonData += ",\"gz\":";
    jsonData += String(currentGz, 4);

    jsonData += ",\"totalAcceleration\":";
    jsonData += String(totalAcceleration, 4);

    jsonData += ",\"totalGyro\":";
    jsonData += String(totalGyro, 4);

    // Original application fields
    bool impactDetected =
        totalAcceleration >= 2.0f;

    jsonData += ",\"impactDetected\":";
    jsonData += impactDetected ? "true" : "false";

    jsonData += ",\"fallDetected\":";
    jsonData += fallDetected ? "true" : "false";

    jsonData += ",\"status\":\"";
    jsonData += mlStatus;
    jsonData += "\"";

    // --------------------------------------------------------
    // ML fields
    // --------------------------------------------------------

    jsonData += ",\"fallProbability\":";
    jsonData += String(fallProbability, 6);

    jsonData += ",\"mlPrediction\":\"";
    jsonData += mlPrediction;
    jsonData += "\"";

    jsonData += ",\"mlConfirmed\":";
    jsonData += fallDetected ? "true" : "false";

    jsonData += ",\"fallConfirmCount\":";
    jsonData += String(fallConfirmCount);

    jsonData += ",\"model\":\"RF300\"";

    jsonData += ",\"threshold\":";
    jsonData += String(FALL_THRESHOLD, 2);

    // MAX30102 vitals. Null means no valid calculation is available yet.
    jsonData += ",\"heartRate\":";
    if (max30102Detected && maxBufferReady && validHeartRate && heartRate >= 40 && heartRate <= 200)
        jsonData += String(heartRate);
    else
        jsonData += "null";

    jsonData += ",\"heartRateValid\":";
    jsonData += (max30102Detected && maxBufferReady && validHeartRate && heartRate >= 40 && heartRate <= 200) ? "true" : "false";

    jsonData += ",\"spo2\":";
    if (max30102Detected && maxBufferReady && validSpO2 && spo2 >= 70 && spo2 <= 100)
        jsonData += String(spo2);
    else
        jsonData += "null";

    jsonData += ",\"spo2Valid\":";
    jsonData += (max30102Detected && maxBufferReady && validSpO2 && spo2 >= 70 && spo2 <= 100) ? "true" : "false";

    // The backend should act on this field (for example, notify caregivers).
    // Keep it true until this exact payload receives an HTTP 2xx response.
    const bool sosIncludedInThisPayload = sosPending;
    jsonData += ",\"sosPressed\":";
    jsonData += sosIncludedInThisPayload ? "true" : "false";

    jsonData += "}";


    Serial.println();
    Serial.println("Sending data:");

    Serial.println(jsonData);


    int httpResponseCode =
        http.POST(jsonData);


    if (httpResponseCode > 0)
    {
        Serial.print("HTTP Response: ");
        Serial.println(httpResponseCode);

        String response =
            http.getString();

        Serial.println("Server:");
        Serial.println(response);

        if (httpResponseCode >= 200 && httpResponseCode < 300 && sosIncludedInThisPayload)
        {
            sosPending = false;
            Serial.println("SOS event acknowledged by backend.");
        }
    }
    else
    {
        Serial.print("HTTP Error: ");
        Serial.println(httpResponseCode);
    }

    http.end();
}


// ============================================================
// WIFI
// ============================================================

void connectWiFi()
{
    Serial.println();
    Serial.println("Connecting to WiFi...");

    WiFi.mode(WIFI_STA);

    WiFi.begin(
        WIFI_SSID,
        WIFI_PASSWORD
    );

    int attempts = 0;

    while (
        WiFi.status() != WL_CONNECTED &&
        attempts < 30
    )
    {
        delay(500);

        Serial.print(".");

        attempts++;
    }

    Serial.println();

    if (WiFi.status() == WL_CONNECTED)
    {
        Serial.println("WiFi connected!");

        Serial.print("ESP32 IP: ");
        Serial.println(WiFi.localIP());

        Serial.print("Server: ");
        Serial.println(SERVER_URL);
    }
    else
    {
        Serial.println(
            "WiFi connection failed."
        );
    }
}


// ============================================================
// SETUP MPU6050
// ============================================================

void setupMPU()
{
    Serial.println(
        "Initializing MPU6050..."
    );

    // Wake MPU6050
    writeMPURegister(
        0x6B,
        0x00
    );

    delay(100);

    // Accelerometer +/-8g
    writeMPURegister(
        0x1C,
        0x10
    );

    // Gyroscope +/-500 deg/s
    writeMPURegister(
        0x1B,
        0x08
    );

    // Digital Low Pass Filter
    writeMPURegister(
        0x1A,
        0x03
    );

    // Sample divider
    // Actual application sampling is controlled
    // by loop timing below.
    writeMPURegister(
        0x19,
        0x00
    );

    uint8_t whoAmI =
        readMPURegister(0x75);

    Serial.print(
        "MPU6050 WHO_AM_I: 0x"
    );

    Serial.println(
        whoAmI,
        HEX
    );

    if (
        whoAmI == 0x68 ||
        whoAmI == 0x69
    )
    {
        Serial.println(
            "MPU6050 detected."
        );
    }
    else
    {
        Serial.println(
            "WARNING: MPU6050 not detected."
        );
    }
}


// ============================================================
// SETUP
// ============================================================

void setup()
{
    Serial.begin(115200);

    delay(1000);

    Serial.println();
    Serial.println(
        "======================================"
    );
    Serial.println(
        "       GUARDIAN 360"
    );
    Serial.println(
        " ESP32 + MPU6050 + RF-300"
    );
    Serial.println(
        "======================================"
    );

    Serial.print("RF Trees: ");
    Serial.println(RF_NUM_TREES);

    Serial.print("Features: ");
    Serial.println(NUM_FEATURES);

    Serial.print("Window: ");
    Serial.println(WINDOW_SIZE);

    Serial.print("Step: ");
    Serial.println(WINDOW_STEP);

    Serial.print("Sampling Rate: ");
    Serial.print(SAMPLE_RATE);
    Serial.println(" Hz");

    Serial.print("Fall Threshold: ");
    Serial.println(FALL_THRESHOLD);


    // --------------------------------------------------------
    // SOS button
    // --------------------------------------------------------

    pinMode(SOS_BUTTON_PIN, INPUT_PULLUP);
    sosLastRawReading = digitalRead(SOS_BUTTON_PIN);
    sosStableState = sosLastRawReading;
    sosLastDebounceTime = millis();
    Serial.print("SOS button input initialized on GPIO ");
    Serial.println(SOS_BUTTON_PIN);

    // --------------------------------------------------------
    // I2C
    // --------------------------------------------------------

    Wire.begin(
        SDA_PIN,
        SCL_PIN
    );

    Wire.setClock(400000);

    delay(100);

    // --------------------------------------------------------
    // I2C LCD: Guardian 360 startup screen
    // --------------------------------------------------------

    lcd.init();
    lcd.backlight();
    lcd.clear();

    lcd.setCursor(2, 0);
    lcd.print("GUARDIAN 360");

    lcd.setCursor(3, 1);
    lcd.print("Elderly Care");


    // --------------------------------------------------------
    // MPU
    // --------------------------------------------------------

    setupMPU();

    // --------------------------------------------------------
    // MAX30102
    // --------------------------------------------------------
    Serial.println("Initializing MAX30102...");
    max30102Detected = max30102.begin(Wire, I2C_SPEED_FAST);
    if (max30102Detected)
    {
        byte ledBrightness = 60;
        byte sampleAverage = 4;
        byte ledMode = 2;       // Red + IR
        int sampleRate = 100;
        int pulseWidth = 411;
        int adcRange = 4096;
        max30102.setup(ledBrightness, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange);
        Serial.println("MAX30102 detected. Place finger on sensor.");
    }
    else
    {
        Serial.println("WARNING: MAX30102 not detected; fall detection will continue.");
    }


    // --------------------------------------------------------
    // WiFi
    // --------------------------------------------------------

    connectWiFi();


    // --------------------------------------------------------
    // Initialize buffer
    // --------------------------------------------------------

    for (int i = 0; i < WINDOW_SIZE; i++)
    {
        for (int j = 0; j < 6; j++)
        {
            windowData[i][j] = 0.0f;
        }
    }


    Serial.println();
    Serial.println(
        "System ready."
    );

    Serial.println(
        "Collecting 20 samples..."
    );

    Serial.println();
}


// ============================================================
// MAIN LOOP
// ============================================================

void loop()
{
    static unsigned long lastSampleTime = 0;

    // Check every loop iteration so an SOS press is not missed between samples.
    checkSOSButton();

    // Keep MAX30102 samples flowing even between MPU6050 samples.
    updateMAX30102();

    // ~9.9 Hz for the MPU6050 model window
    const unsigned long SAMPLE_INTERVAL_MS = 101;

    unsigned long now = millis();

    if (
        now - lastSampleTime <
        SAMPLE_INTERVAL_MS
    )
    {
        return;
    }

    lastSampleTime = now;


    // --------------------------------------------------------
    // Read MPU6050
    // --------------------------------------------------------

    readMPU();


    // --------------------------------------------------------
    // Add sample to rolling window
    // --------------------------------------------------------

    if (windowIndex < WINDOW_SIZE)
    {
        windowData[windowIndex][0] =
            currentAx;

        windowData[windowIndex][1] =
            currentAy;

        windowData[windowIndex][2] =
            currentAz;

        windowData[windowIndex][3] =
            currentGx;

        windowData[windowIndex][4] =
            currentGy;

        windowData[windowIndex][5] =
            currentGz;

        windowIndex++;
    }


    // --------------------------------------------------------
    // First inference after 20 samples
    // --------------------------------------------------------

    if (windowIndex == WINDOW_SIZE)
    {
        runInference();

        sendSensorData();

        windowReady = true;

        samplesSinceInference = 0;

        // ----------------------------------------------------
        // Shift by 10 samples
        // ----------------------------------------------------

        for (
            int i = 0;
            i < WINDOW_SIZE - WINDOW_STEP;
            i++
        )
        {
            for (int j = 0; j < 6; j++)
            {
                windowData[i][j] =
                    windowData[
                        i + WINDOW_STEP
                    ][j];
            }
        }

        windowIndex =
            WINDOW_SIZE - WINDOW_STEP;
    }
}