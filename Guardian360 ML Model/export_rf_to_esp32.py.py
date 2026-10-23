import os
import joblib
import numpy as np

# ============================================================
# Guardian 360
# Optimized Random Forest -> ESP32
# ============================================================

BASE_DIR = r"D:\Guardian360"

MODEL_PATH = os.path.join(
    BASE_DIR,
    "models",
    "guardian360_combined_random_forest.joblib"
)

HEADER_PATH = os.path.join(
    BASE_DIR,
    "models",
    "guardian360_rf_model.h"
)

TEST_VECTOR_PATH = os.path.join(
    BASE_DIR,
    "models",
    "guardian360_rf_test_vector.h"
)

EXPECTED_TREES = 300
EXPECTED_FEATURES = 104
FALL_THRESHOLD = 0.47


# ============================================================
# LOAD MODEL
# ============================================================

print("=" * 70)
print("Guardian 360 - Optimized RF ESP32 Exporter")
print("=" * 70)

print("\nLoading:")
print(MODEL_PATH)

bundle = joblib.load(MODEL_PATH)

if not isinstance(bundle, dict):
    raise RuntimeError(
        "Expected the saved model bundle to be a dictionary."
    )

model = bundle["model"]
feature_names = bundle["feature_names"]

if model.n_estimators != EXPECTED_TREES:
    raise RuntimeError(
        f"Expected {EXPECTED_TREES} trees, "
        f"found {model.n_estimators}"
    )

if model.n_features_in_ != EXPECTED_FEATURES:
    raise RuntimeError(
        f"Expected {EXPECTED_FEATURES} features, "
        f"found {model.n_features_in_}"
    )

if list(model.classes_) != [0, 1]:
    raise RuntimeError(
        f"Expected classes [0, 1], "
        f"found {model.classes_}"
    )

if len(feature_names) != EXPECTED_FEATURES:
    raise RuntimeError(
        f"Expected {EXPECTED_FEATURES} feature names, "
        f"found {len(feature_names)}"
    )

print("\nModel:")
print(f"  Trees   : {model.n_estimators}")
print(f"  Features: {model.n_features_in_}")
print(f"  Classes : {model.classes_}")


# ============================================================
# GLOBAL ARRAYS
# ============================================================

all_features = []
all_left = []
all_right = []
all_thresholds = []
all_probabilities = []

tree_offsets = []
tree_node_counts = []

total_nodes = 0
total_leaves = 0
max_nodes = 0


# ============================================================
# CONVERT TREES
# ============================================================

print("\nConverting trees...")

for tree_index, estimator in enumerate(model.estimators_):

    tree = estimator.tree_

    node_count = int(tree.node_count)

    if node_count > 32767:
        raise RuntimeError(
            f"Tree {tree_index} has {node_count} nodes. "
            "int16_t is not sufficient."
        )

    tree_offsets.append(total_nodes)
    tree_node_counts.append(node_count)

    max_nodes = max(max_nodes, node_count)

    for node in range(node_count):

        left = int(tree.children_left[node])
        right = int(tree.children_right[node])

        is_leaf = (
            left == -1 and
            right == -1
        )

        # ----------------------------------------------------
        # Feature
        # ----------------------------------------------------

        if is_leaf:

            feature = 255

        else:

            feature = int(
                tree.feature[node]
            )

            if feature < 0 or feature >= EXPECTED_FEATURES:
                raise RuntimeError(
                    f"Invalid feature index {feature} "
                    f"in tree {tree_index}, node {node}"
                )

        # ----------------------------------------------------
        # Child indices
        # ----------------------------------------------------

        if is_leaf:

            left_out = -1
            right_out = -1

        else:

            left_out = left
            right_out = right

        # ----------------------------------------------------
        # Threshold
        # ----------------------------------------------------

        if is_leaf:

            threshold = 0.0

        else:

            threshold = float(
                tree.threshold[node]
            )

        # ----------------------------------------------------
        # FALL probability
        #
        # class 0 = NORMAL
        # class 1 = FALL
        # ----------------------------------------------------

        if is_leaf:

            class_counts = tree.value[node][0]

            total = float(
                np.sum(class_counts)
            )

            if total > 0.0:

                probability = float(
                    class_counts[1] / total
                )

            else:

                probability = 0.0

            total_leaves += 1

        else:

            probability = 0.0

        # ----------------------------------------------------
        # Append
        # ----------------------------------------------------

        all_features.append(feature)
        all_left.append(left_out)
        all_right.append(right_out)
        all_thresholds.append(threshold)
        all_probabilities.append(probability)

        total_nodes += 1


# ============================================================
# NUMPY ARRAYS
# ============================================================

features_np = np.asarray(
    all_features,
    dtype=np.uint8
)

left_np = np.asarray(
    all_left,
    dtype=np.int16
)

right_np = np.asarray(
    all_right,
    dtype=np.int16
)

thresholds_np = np.asarray(
    all_thresholds,
    dtype=np.float32
)

probabilities_np = np.asarray(
    all_probabilities,
    dtype=np.float32
)

tree_offsets_np = np.asarray(
    tree_offsets,
    dtype=np.uint32
)

tree_node_counts_np = np.asarray(
    tree_node_counts,
    dtype=np.uint16
)


# ============================================================
# VALIDATION CHECKS
# ============================================================

assert len(features_np) == total_nodes
assert len(left_np) == total_nodes
assert len(right_np) == total_nodes
assert len(thresholds_np) == total_nodes
assert len(probabilities_np) == total_nodes

assert len(tree_offsets_np) == EXPECTED_TREES
assert len(tree_node_counts_np) == EXPECTED_TREES

print("\nTree statistics:")
print(f"  Total nodes       : {total_nodes}")
print(f"  Total leaves      : {total_leaves}")
print(f"  Maximum nodes/tree: {max_nodes}")


# ============================================================
# MEMORY ESTIMATE
# ============================================================

feature_bytes = features_np.nbytes
left_bytes = left_np.nbytes
right_bytes = right_np.nbytes
threshold_bytes = thresholds_np.nbytes
probability_bytes = probabilities_np.nbytes

offset_bytes = tree_offsets_np.nbytes
count_bytes = tree_node_counts_np.nbytes

total_model_bytes = (
    feature_bytes
    + left_bytes
    + right_bytes
    + threshold_bytes
    + probability_bytes
    + offset_bytes
    + count_bytes
)

print("\nBinary model storage estimate:")
print(f"  Feature indices : {feature_bytes:,} bytes")
print(f"  Left children   : {left_bytes:,} bytes")
print(f"  Right children  : {right_bytes:,} bytes")
print(f"  Thresholds      : {threshold_bytes:,} bytes")
print(f"  Leaf probability: {probability_bytes:,} bytes")
print(f"  Tree offsets    : {offset_bytes:,} bytes")
print(f"  Tree node count : {count_bytes:,} bytes")
print("  --------------------------------")
print(f"  TOTAL           : {total_model_bytes:,} bytes")
print(
    f"                   "
    f"{total_model_bytes / 1024:.2f} KB"
)
print(
    f"                   "
    f"{total_model_bytes / 1024 / 1024:.2f} MB"
)


# ============================================================
# C++ ARRAY WRITER
# ============================================================

def write_array(
    f,
    c_type,
    name,
    values,
    per_line=16
):

    f.write(
        f"static const {c_type} "
        f"{name}[{len(values)}] "
        f"PROGMEM = {{\n"
    )

    for i, value in enumerate(values):

        # ----------------------------------------------------
        # Integer types
        # ----------------------------------------------------

        if c_type == "uint8_t":

            text = str(
                int(value)
            )

        elif c_type == "int16_t":

            text = str(
                int(value)
            )

        elif c_type == "uint16_t":

            text = str(
                int(value)
            )

        elif c_type == "uint32_t":

            text = str(
                int(value)
            )

        # ----------------------------------------------------
        # Float
        # ----------------------------------------------------

        elif c_type == "float":

            text = f"{float(value):.9g}"

            # Make sure C++ receives a valid
            # floating-point literal.
            #
            # Examples:
            #
            # 0   -> 0.0f
            # 1   -> 1.0f
            # -1  -> -1.0f
            # 2.5 -> 2.5f

            if (
                "." not in text
                and "e" not in text
                and "E" not in text
            ):
                text += ".0"

            text += "f"

        else:

            text = str(value)

        f.write("  " + text)

        if i != len(values) - 1:
            f.write(",")

        if (i + 1) % per_line == 0:
            f.write("\n")

        else:
            f.write(" ")

    f.write("\n};\n\n")


# ============================================================
# GENERATE MODEL HEADER
# ============================================================

print("\nGenerating:")
print(HEADER_PATH)

with open(
    HEADER_PATH,
    "w",
    encoding="utf-8"
) as f:

    f.write(
"""/*
 * ============================================================
 * Guardian 360
 * ESP32 Random Forest Model
 * ============================================================
 *
 * Generated automatically from:
 * guardian360_combined_random_forest.joblib
 *
 * Model:
 *   RandomForestClassifier
 *   Trees: 300
 *   Features: 104
 *
 * Classification:
 *   0 = NORMAL
 *   1 = FALL
 *
 * Final decision threshold:
 *   FALL when probability >= 0.47
 *
 * DO NOT EDIT THIS FILE MANUALLY.
 * ============================================================
 */

#ifndef GUARDIAN360_RF_MODEL_H
#define GUARDIAN360_RF_MODEL_H

#include <Arduino.h>
#include <pgmspace.h>

#define RF_NUM_TREES 300
#define RF_NUM_FEATURES 104
#define RF_FALL_THRESHOLD 0.47f

/*
 * Leaf marker:
 *
 * feature == 255
 *
 * Internal node:
 *
 *   feature[node]
 *   threshold[node]
 *   left[node]
 *   right[node]
 *
 * Leaf:
 *
 *   leaf_probability[node]
 */

#define RF_LEAF 255

"""
    )

    # --------------------------------------------------------
    # Tree metadata
    # --------------------------------------------------------

    write_array(
        f,
        "uint32_t",
        "rf_tree_offsets",
        tree_offsets_np,
        per_line=8
    )

    write_array(
        f,
        "uint16_t",
        "rf_tree_node_counts",
        tree_node_counts_np,
        per_line=12
    )

    # --------------------------------------------------------
    # Model arrays
    # --------------------------------------------------------

    write_array(
        f,
        "uint8_t",
        "rf_features",
        features_np,
        per_line=24
    )

    write_array(
        f,
        "int16_t",
        "rf_left",
        left_np,
        per_line=16
    )

    write_array(
        f,
        "int16_t",
        "rf_right",
        right_np,
        per_line=16
    )

    write_array(
        f,
        "float",
        "rf_thresholds",
        thresholds_np,
        per_line=8
    )

    write_array(
        f,
        "float",
        "rf_leaf_probability",
        probabilities_np,
        per_line=8
    )

    # ========================================================
    # TREE TRAVERSAL
    # ========================================================

    f.write(
r"""
/*
 * ============================================================
 * Predict one decision tree
 * ============================================================
 *
 * Returns:
 *   P(FALL)
 */

static inline float guardian360_predict_tree(
    const float *x,
    uint16_t tree_index
) {
    if (tree_index >= RF_NUM_TREES) {
        return 0.0f;
    }

    uint32_t base =
        pgm_read_dword(
            &rf_tree_offsets[tree_index]
        );

    uint16_t node_count =
        pgm_read_word(
            &rf_tree_node_counts[tree_index]
        );

    int16_t node = 0;

    while (true) {

        /*
         * Safety check.
         */

        if (
            node < 0 ||
            node >= (int16_t)node_count
        ) {
            return 0.0f;
        }

        uint32_t index =
            base + (uint32_t)node;

        /*
         * Read feature index.
         */

        uint8_t feature =
            pgm_read_byte(
                &rf_features[index]
            );

        /*
         * Leaf.
         */

        if (feature == RF_LEAF) {

            return pgm_read_float(
                &rf_leaf_probability[index]
            );
        }

        /*
         * Internal node.
         */

        float threshold =
            pgm_read_float(
                &rf_thresholds[index]
            );

        if (x[feature] <= threshold) {

            node =
                pgm_read_word(
                    &rf_left[index]
                );

        } else {

            node =
                pgm_read_word(
                    &rf_right[index]
                );
        }
    }
}


/*
 * ============================================================
 * Predict complete Random Forest
 * ============================================================
 *
 * Returns:
 *   Average probability of FALL.
 */

static inline float guardian360_predict_rf(
    const float *x
) {
    float probability_sum = 0.0f;

    for (
        uint16_t tree = 0;
        tree < RF_NUM_TREES;
        tree++
    ) {

        probability_sum +=
            guardian360_predict_tree(
                x,
                tree
            );
    }

    return (
        probability_sum /
        (float)RF_NUM_TREES
    );
}


/*
 * ============================================================
 * Final classification
 * ============================================================
 *
 * Returns:
 *   1 = FALL
 *   0 = NORMAL
 */

static inline uint8_t guardian360_predict(
    const float *x
) {
    float probability =
        guardian360_predict_rf(x);

    if (
        probability >=
        RF_FALL_THRESHOLD
    ) {
        return 1;
    }

    return 0;
}

#endif // GUARDIAN360_RF_MODEL_H
"""
    )


header_size = os.path.getsize(
    HEADER_PATH
)

print("\nHeader generated:")
print(
    f"  {header_size:,} bytes "
    f"({header_size / 1024 / 1024:.2f} MB)"
)


# ============================================================
# GENERATE TEST VECTORS
# ============================================================

print("\nGenerating validation vectors...")

test_vectors = np.array(
    [
        np.zeros(EXPECTED_FEATURES),
        np.ones(EXPECTED_FEATURES),
        np.full(EXPECTED_FEATURES, -1.0),
        np.full(EXPECTED_FEATURES, 0.5),
        np.full(EXPECTED_FEATURES, 2.0),
    ],
    dtype=np.float32
)

expected_probabilities = (
    model.predict_proba(
        test_vectors
    )[:, 1]
)


# ============================================================
# GENERATE TEST HEADER
# ============================================================

with open(
    TEST_VECTOR_PATH,
    "w",
    encoding="utf-8"
) as f:

    f.write(
"""/*
 * ============================================================
 * Guardian 360 RF validation vectors
 * ============================================================
 */

#ifndef GUARDIAN360_RF_TEST_VECTOR_H
#define GUARDIAN360_RF_TEST_VECTOR_H

#include <Arduino.h>

#define RF_TEST_VECTOR_COUNT 5
#define RF_TEST_FEATURE_COUNT 104

"""
    )

    for i, vector in enumerate(test_vectors):

        write_array(
            f,
            "float",
            f"rf_test_vector_{i}",
            vector,
            per_line=8
        )

    write_array(
        f,
        "float",
        "rf_expected_probability",
        expected_probabilities,
        per_line=8
    )

    f.write(
        "#endif\n"
    )


# ============================================================
# TEST VECTOR OUTPUT
# ============================================================

print("\nTest vectors:")

for i, probability in enumerate(
    expected_probabilities
):

    result = (
        "FALL"
        if probability >= FALL_THRESHOLD
        else "NORMAL"
    )

    print(
        f"  Vector {i}: "
        f"{probability:.9f} "
        f"-> {result}"
    )


# ============================================================
# FINAL
# ============================================================

test_size = os.path.getsize(
    TEST_VECTOR_PATH
)

print("\nFiles generated:")

print(
    f"  Model: "
    f"{HEADER_PATH}"
)

print(
    f"         "
    f"{header_size:,} bytes"
)

print(
    f"  Tests: "
    f"{TEST_VECTOR_PATH}"
)

print(
    f"         "
    f"{test_size:,} bytes"
)

print("\n" + "=" * 70)
print("EXPORT COMPLETE")
print("=" * 70)