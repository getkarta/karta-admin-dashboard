import {
  insertEdge,
  insertEdgeLabel,
  markers_default,
  positionEdgeLabel
} from "./chunk-2N5L2ZMR.js";
import {
  insertCluster,
  insertNode,
  labelHelper
} from "./chunk-H2EE2UHL.js";
import {
  interpolateToCurve
} from "./chunk-6OLVR3GS.js";
import {
  common_default,
  getConfig
} from "./chunk-EELJO2LH.js";
import {
  __name,
  log
} from "./chunk-LCVDMSNF.js";
import {
  __async
} from "./chunk-GVCIBACH.js";

// node_modules/mermaid/dist/chunks/mermaid.core/chunk-6OXUPJBA.mjs
var internalHelpers = {
  common: common_default,
  getConfig,
  insertCluster,
  insertEdge,
  insertEdgeLabel,
  insertMarkers: markers_default,
  insertNode,
  interpolateToCurve,
  labelHelper,
  log,
  positionEdgeLabel
};
var layoutAlgorithms = {};
var registerLayoutLoaders = /* @__PURE__ */ __name((loaders) => {
  for (const loader of loaders) {
    layoutAlgorithms[loader.name] = loader;
  }
}, "registerLayoutLoaders");
var registerDefaultLayoutLoaders = /* @__PURE__ */ __name(() => {
  registerLayoutLoaders([{
    name: "dagre",
    loader: /* @__PURE__ */ __name(() => __async(null, null, function* () {
      return yield import("./chunk-R4BUMFST.js");
    }), "loader")
  }, ...true ? [{
    name: "cose-bilkent",
    loader: /* @__PURE__ */ __name(() => __async(null, null, function* () {
      return yield import("./chunk-XAKBESYC.js");
    }), "loader")
  }] : []]);
}, "registerDefaultLayoutLoaders");
registerDefaultLayoutLoaders();
var render = /* @__PURE__ */ __name((data4Layout, svg) => __async(null, null, function* () {
  if (!(data4Layout.layoutAlgorithm in layoutAlgorithms)) {
    throw new Error(`Unknown layout algorithm: ${data4Layout.layoutAlgorithm}`);
  }
  const layoutDefinition = layoutAlgorithms[data4Layout.layoutAlgorithm];
  const layoutRenderer = yield layoutDefinition.loader();
  return layoutRenderer.render(data4Layout, svg, internalHelpers, {
    algorithm: layoutDefinition.algorithm
  });
}), "render");
var getRegisteredLayoutAlgorithm = /* @__PURE__ */ __name((algorithm = "", {
  fallback = "dagre"
} = {}) => {
  if (algorithm in layoutAlgorithms) {
    return algorithm;
  }
  if (fallback in layoutAlgorithms) {
    log.warn(`Layout algorithm ${algorithm} is not registered. Using ${fallback} as fallback.`);
    return fallback;
  }
  throw new Error(`Both layout algorithms ${algorithm} and ${fallback} are not registered.`);
}, "getRegisteredLayoutAlgorithm");

export {
  registerLayoutLoaders,
  render,
  getRegisteredLayoutAlgorithm
};
//# sourceMappingURL=chunk-4SWUCBNH.js.map
