import JavaScriptObfuscator from 'javascript-obfuscator';
import { defineConfig, type Plugin } from 'vite';

function obfuscateBuildOutput(): Plugin {
  return {
    name: 'obfuscate-build-output',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      for (const item of Object.values(bundle)) {
        if (item.type !== 'chunk' || !item.fileName.endsWith('.js')) continue;

        item.code = JavaScriptObfuscator.obfuscate(item.code, {
          compact: true,
          controlFlowFlattening: false,
          deadCodeInjection: false,
          debugProtection: false,
          disableConsoleOutput: false,
          identifierNamesGenerator: 'hexadecimal',
          ignoreImports: true,
          renameGlobals: false,
          selfDefending: false,
          simplify: true,
          sourceMap: false,
          stringArray: true,
          stringArrayCallsTransform: true,
          stringArrayCallsTransformThreshold: 0.35,
          stringArrayEncoding: [],
          stringArrayRotate: true,
          stringArrayShuffle: true,
          stringArrayThreshold: 0.55,
          target: 'browser',
          transformObjectKeys: false,
          unicodeEscapeSequence: false
        }).getObfuscatedCode();
      }
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [obfuscateBuildOutput()],
  build: {
    minify: 'esbuild',
    sourcemap: false,
    target: 'es2020'
  }
});
