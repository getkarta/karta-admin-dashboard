import {
  AbstractMermaidTokenBuilder,
  CommonValueConverter,
  EmptyFileSystem,
  MermaidGeneratedSharedModule,
  PacketGeneratedModule,
  __name,
  createDefaultCoreModule,
  createDefaultSharedCoreModule,
  inject,
  lib_exports
} from "./chunk-HEWIL5EO.js";

// node_modules/@mermaid-js/parser/dist/chunks/mermaid-parser.core/chunk-KMC2YHZD.mjs
var PacketTokenBuilder = class extends AbstractMermaidTokenBuilder {
  static {
    __name(this, "PacketTokenBuilder");
  }
  constructor() {
    super(["packet"]);
  }
};
var PacketModule = {
  parser: {
    TokenBuilder: /* @__PURE__ */ __name(() => new PacketTokenBuilder(), "TokenBuilder"),
    ValueConverter: /* @__PURE__ */ __name(() => new CommonValueConverter(), "ValueConverter")
  }
};
function createPacketServices(context = EmptyFileSystem) {
  const shared = inject(createDefaultSharedCoreModule(context), MermaidGeneratedSharedModule);
  const Packet = inject(createDefaultCoreModule({
    shared
  }), PacketGeneratedModule, PacketModule);
  shared.ServiceRegistry.register(Packet);
  return {
    shared,
    Packet
  };
}
__name(createPacketServices, "createPacketServices");

export {
  PacketModule,
  createPacketServices
};
//# sourceMappingURL=chunk-WOAEQZ7F.js.map
