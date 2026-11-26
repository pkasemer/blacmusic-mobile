// Loads the app's TypeScript files in Node for tests, with stand-ins for the modules that need a phone or a server.
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const SRC = path.join(__dirname, '..', 'src');

module.exports = function makeLoader(stubs = {}) {
  const cache = {};
  const resolve = (base) => {
    const file = [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')].find((f) => fs.existsSync(f));
    if (!file) throw new Error(`cannot resolve ${base}`);
    return file;
  };
  function load(file) {
    if (cache[file]) return cache[file].exports;
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const module = (cache[file] = { exports: {} });
    const requireIn = (name) => {
      if (name in stubs) return stubs[name];
      if (name.startsWith('@/')) return load(resolve(path.join(SRC, name.slice(2))));
      if (name.startsWith('.')) {
        const target = path.join(path.dirname(file), name);
        const alias = `@/${path.relative(SRC, target).split(path.sep).join('/')}`;
        return alias in stubs ? stubs[alias] : load(resolve(target));
      }
      return require(name);
    };
    new Function('require', 'module', 'exports', code)(requireIn, module, module.exports);
    return module.exports;
  }
  return (name) => load(resolve(path.join(SRC, name)));
};
