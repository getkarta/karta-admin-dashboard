import {
  AbstractMermaidTokenBuilder,
  CommonValueConverter,
  EmptyFileSystem,
  InfoGeneratedModule,
  MermaidGeneratedSharedModule,
  __name,
  createDefaultCoreModule,
  createDefaultSharedCoreModule,
  inject,
  lib_exports
} from "./chunk-HEWIL5EO.js";

// node_modules/@mermaid-js/parser/dist/chunks/mermaid-parser.core/chunk-T44TD3VJ.mjs
var InfoTokenBuilder = class extends AbstractMermaidTokenBuilder {
  static {
    __name(this, "InfoTokenBuilder");
  }
  constructor() {
    super(["info", "showInfo"]);
  }
};
var InfoModule = {
  parser: {
    TokenBuilder: /* @__PURE__ */ __name(() => new InfoTokenBuilder(), "TokenBuilder"),
    ValueConverter: /* @__PURE__ */ __name(() => new CommonValueConverter(), "ValueConverter")
  }
};
function createInfoServices(context = EmptyFileSystem) {
  const shared = inject(createDefaultSharedCoreModule(context), MermaidGeneratedSharedModule);
  const Info = inject(createDefaultCoreModule({
    shared
  }), InfoGeneratedModule, InfoModule);
  shared.ServiceRegistry.register(Info);
  return {
    shared,
    Info
  };
}
__name(createInfoServices, "createInfoServices");

export {
  InfoModule,
  createInfoServices
};
//# sourceMappingURL=chunk-JF2VWEU6.js.map
