import {
  parse
} from "./chunk-BRI4WUIV.js";
import "./chunk-WOAEQZ7F.js";
import "./chunk-TKRONTEV.js";
import "./chunk-SOHT5HCM.js";
import "./chunk-LNMRXIYV.js";
import "./chunk-777KBZB2.js";
import "./chunk-TIOEAISI.js";
import {
  package_default
} from "./chunk-XSHIZCES.js";
import {
  selectSvgElement
} from "./chunk-SPG36DBM.js";
import {
  configureSvgSize
} from "./chunk-EELJO2LH.js";
import {
  __name,
  log
} from "./chunk-LCVDMSNF.js";
import "./chunk-JF2VWEU6.js";
import "./chunk-HEWIL5EO.js";
import "./chunk-4MD7JHFY.js";
import "./chunk-U53DVM5X.js";
import "./chunk-RU5GTINO.js";
import {
  __async
} from "./chunk-GVCIBACH.js";

// node_modules/mermaid/dist/chunks/mermaid.core/infoDiagram-STP46IZ2.mjs
var parser = {
  parse: /* @__PURE__ */ __name((input) => __async(null, null, function* () {
    const ast = yield parse("info", input);
    log.debug(ast);
  }), "parse")
};
var DEFAULT_INFO_DB = {
  version: package_default.version + (true ? "" : "-tiny")
};
var getVersion = /* @__PURE__ */ __name(() => DEFAULT_INFO_DB.version, "getVersion");
var db = {
  getVersion
};
var draw = /* @__PURE__ */ __name((text, id, version) => {
  log.debug("rendering info diagram\n" + text);
  const svg = selectSvgElement(id);
  configureSvgSize(svg, 100, 400, true);
  const group = svg.append("g");
  group.append("text").attr("x", 100).attr("y", 40).attr("class", "version").attr("font-size", 32).style("text-anchor", "middle").text(`v${version}`);
}, "draw");
var renderer = {
  draw
};
var diagram = {
  parser,
  db,
  renderer
};
export {
  diagram
};
//# sourceMappingURL=chunk-DQ626IQD.js.map
