import {
  __name
} from "./chunk-HEWIL5EO.js";
import {
  __async
} from "./chunk-GVCIBACH.js";

// node_modules/@mermaid-js/parser/dist/mermaid-parser.core.mjs
var parsers = {};
var initializers = {
  info: /* @__PURE__ */ __name(() => __async(null, null, function* () {
    const {
      createInfoServices: createInfoServices2
    } = yield import("./chunk-BRON2SMB.js");
    const parser = createInfoServices2().Info.parser.LangiumParser;
    parsers.info = parser;
  }), "info"),
  packet: /* @__PURE__ */ __name(() => __async(null, null, function* () {
    const {
      createPacketServices: createPacketServices2
    } = yield import("./chunk-ZU5UILLL.js");
    const parser = createPacketServices2().Packet.parser.LangiumParser;
    parsers.packet = parser;
  }), "packet"),
  pie: /* @__PURE__ */ __name(() => __async(null, null, function* () {
    const {
      createPieServices: createPieServices2
    } = yield import("./chunk-YCGUXYCO.js");
    const parser = createPieServices2().Pie.parser.LangiumParser;
    parsers.pie = parser;
  }), "pie"),
  architecture: /* @__PURE__ */ __name(() => __async(null, null, function* () {
    const {
      createArchitectureServices: createArchitectureServices2
    } = yield import("./chunk-CJMWMDAT.js");
    const parser = createArchitectureServices2().Architecture.parser.LangiumParser;
    parsers.architecture = parser;
  }), "architecture"),
  gitGraph: /* @__PURE__ */ __name(() => __async(null, null, function* () {
    const {
      createGitGraphServices: createGitGraphServices2
    } = yield import("./chunk-NKAQJGLZ.js");
    const parser = createGitGraphServices2().GitGraph.parser.LangiumParser;
    parsers.gitGraph = parser;
  }), "gitGraph"),
  radar: /* @__PURE__ */ __name(() => __async(null, null, function* () {
    const {
      createRadarServices: createRadarServices2
    } = yield import("./chunk-DNEDEMUX.js");
    const parser = createRadarServices2().Radar.parser.LangiumParser;
    parsers.radar = parser;
  }), "radar"),
  treemap: /* @__PURE__ */ __name(() => __async(null, null, function* () {
    const {
      createTreemapServices: createTreemapServices2
    } = yield import("./chunk-3UYNNS7S.js");
    const parser = createTreemapServices2().Treemap.parser.LangiumParser;
    parsers.treemap = parser;
  }), "treemap")
};
function parse(diagramType, text) {
  return __async(this, null, function* () {
    const initializer = initializers[diagramType];
    if (!initializer) {
      throw new Error(`Unknown diagram type: ${diagramType}`);
    }
    if (!parsers[diagramType]) {
      yield initializer();
    }
    const parser = parsers[diagramType];
    const result = parser.parse(text);
    if (result.lexerErrors.length > 0 || result.parserErrors.length > 0) {
      throw new MermaidParseError(result);
    }
    return result.value;
  });
}
__name(parse, "parse");
var MermaidParseError = class extends Error {
  constructor(result) {
    const lexerErrors = result.lexerErrors.map((err) => err.message).join("\n");
    const parserErrors = result.parserErrors.map((err) => err.message).join("\n");
    super(`Parsing failed: ${lexerErrors} ${parserErrors}`);
    this.result = result;
  }
  static {
    __name(this, "MermaidParseError");
  }
};

export {
  parse
};
//# sourceMappingURL=chunk-BRI4WUIV.js.map
