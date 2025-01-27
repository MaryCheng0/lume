import { Site } from "../core.ts";
import { Eta } from "../deps/eta.ts";
import { posix } from "../deps/path.ts";
import loader from "../core/loaders/text.ts";
import { merge } from "../core/utils.ts";

import type { Data, Engine, Helper, HelperOptions } from "../core.ts";
import type { EtaConfig } from "../deps/eta.ts";

export interface Options {
  /** The list of extensions this plugin applies to */
  extensions: string[] | {
    pages: string[];
    components: string[];
  };

  /** Custom includes path */
  includes: string;

  /** Configuration to pass to Eta */
  options: Partial<EtaConfig>;
}

// Default options
export const defaults: Options = {
  extensions: [".eta"],
  includes: "",
  options: {
    useWith: true,
  },
};

/** Template engine to render Eta files */
export class EtaEngine implements Engine {
  engine: Eta;
  filters: Record<string, Helper> = {};
  basePath: string;

  constructor(engine: Eta, basePath: string) {
    this.engine = engine;
    this.basePath = basePath;
  }

  deleteCache(file: string): void {
    const path = posix.join(this.basePath, file);
    this.engine.templatesSync.remove(path);
    this.engine.templatesAsync.remove(path);
  }

  render(content: string, data: Data, filename: string) {
    const template = this.getTemplate(content, filename, true);

    data.filters = this.filters;
    return this.engine.renderAsync(template, data, { filepath: filename });
  }

  renderSync(content: string, data: Data, filename: string): string {
    const template = this.getTemplate(content, filename, false);

    data.filters = this.filters;
    return this.engine.render(template, data, { filepath: filename });
  }

  getTemplate(content: string, filename: string, async?: boolean) {
    filename = posix.join(this.basePath, filename);

    const templates = async
      ? this.engine.templatesAsync
      : this.engine.templatesSync;
    if (!templates.get(filename)) {
      templates.define(
        filename,
        this.engine.compile(
          content,
          { async },
        ),
      );
    }
    return templates.get(filename)!;
  }

  addHelper(name: string, fn: Helper, options: HelperOptions) {
    switch (options.type) {
      case "filter":
        this.filters[name] = fn;
        return;
    }
  }
}

/** Register the plugin to use Eta as a template engine */
export default function (userOptions?: Partial<Options>) {
  return (site: Site) => {
    const options = merge(
      { ...defaults, includes: site.options.includes },
      userOptions,
    );

    // Configure Eta
    const eta = new Eta({
      ...options.options,
      views: site.src(options.includes),
    });

    const extensions = Array.isArray(options.extensions)
      ? { pages: options.extensions, components: options.extensions }
      : options.extensions;

    const engine = new EtaEngine(eta, site.src());

    site.loadPages(extensions.pages, loader, engine);
    site.includes(extensions.pages, options.includes);
    site.includes(extensions.components, options.includes);
    site.loadComponents(extensions.components, loader, engine);
  };
}
