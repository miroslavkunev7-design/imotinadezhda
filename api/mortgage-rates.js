const lib = require("./_mortgage-rates");

module.exports = async (req, res) => {
  try {
    const packed = await lib.readPacked();
    lib.json(res, 200, packed);
  } catch (e) {
    lib.json(res, 200, lib.pack(lib.seedRows(), { source: "seed", error: String(e && e.message || e) }));
  }
};
