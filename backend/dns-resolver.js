const dns = require("dns");

const originalLookup = dns.lookup;
const fallbackResolver = new dns.promises.Resolver();
fallbackResolver.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

dns.lookup = function (hostname, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }

  originalLookup(hostname, options, (err, address, family) => {
    if (!err && address) {
      return callback(null, address, family);
    }

    if (!hostname || typeof hostname !== "string") {
      return callback(err);
    }

    fallbackResolver
      .resolve4(hostname)
      .then((addresses) => {
        if (!addresses || addresses.length === 0) {
          return callback(err || new Error(`Could not resolve ${hostname}`));
        }
        if (options && options.all) {
          callback(
            null,
            addresses.map((addr) => ({ address: addr, family: 4 }))
          );
        } else {
          callback(null, addresses[0], 4);
        }
      })
      .catch(() => {
        callback(err || new Error(`Failed to resolve host: ${hostname}`));
      });
  });
};

module.exports = {};
