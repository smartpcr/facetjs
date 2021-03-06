expressionParser = (<PEGParserFactory>require("../parser/expression"))(Facet);
sqlParser = (<PEGParserFactory>require("../parser/sql"))(Facet);

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = Facet;
  module.exports.helper = Facet.Helper;

  // Make Chronology available outside of facet as well
  module.exports.Chronology = Chronology;
}
