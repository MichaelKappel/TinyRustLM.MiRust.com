# Implementation Documentation

Implementation docs copied from TinyRustLM and the workspace root so public docs can deep-link the source-backed architecture.

Updated UTC: 2026-07-01T21:20:00Z

Count: 14

- [SLM Composer Source Options UI v1.0.7](slmcomposer-source-options-ui-v1.0.7.md): SLM Composer now defaults to Chat mode with starter profiles, local/Hugging Face/P2P source choices, and Advanced Tools for diagnostics.

- [TinyRustLM Architecture](architecture.md): TinyRustLM is a browser-local SLM runtime with a static UI, handwritten JavaScript bootstrap, no-crate Rust local server, no-crate Rust mini browser harness, Rust WASM runtime, and local .s…  
  `sha256:6EE3C495E1E518E249AD38BE548F98DF31B86B82614A9AFB93C5778F6233E269`
- [Browser Runtime](browser-runtime.md): The browser runtime hosts TinyRustLM as static files and keeps prompts local to the user browser.  
  `sha256:8DDE334D27A44979124441E7221B68310F76A39195C6F9D73CA12E4D6597776C`
- [Performance](performance.md): Performance work keeps the browser runtime responsive while protecting correctness.  
  `sha256:07A74898373F6807DE99BB1BCB3748A16460F0CB4CCE45D857CB56533A2A1B33`
- [Quantization](quantization.md): Quantization reduces model download size and memory pressure. The current implementation proves q80 and q40 with tiny fixture files and proves TinyLM-16M f32/q80/q40 smoke models, with dire…  
  `sha256:1B1AFD7292FFD7FE5F023EE9BBF33169E1A2A839673434AE481603DAFA55A700`
- [SLM Format](slm-format.md): .slm is the local model file format for TinyRustLM. It is designed for simple browser loading and strict Rust-side validation.  
  `sha256:4D06F94001165FBA0E996ADFE2DB234CA66B758379F807E716F6B7D542EA7627`
- [Testing](testing.md): Tests prove each low-level primitive before the runtime claims TinyLM-16M support.  
  `sha256:FEEB5288862F939384B44320EA75AF0DEE06BDF76E1D919B9A543BEEB448C5A4`
- [Tokenizer](tokenizer.md): The tokenizer layer proves prompt transfer and generation plumbing without external tokenizer libraries. Phase one uses a fixed byte tokenizer. Phase two adds a small custom BPE tokenizer s…  
  `sha256:B133955180A0AF4F260C81F6438E1C586A27A4863068AD4B6E82C32DCB14D18F`
- [Runtime.MiRust.com](workspace-readme.md): Canonical Rust source root for the Runtime.MiRust.com client-side SLM runtime and browser UI.  
  `sha256:D897DBAA37E6E199A09677D45E7A29DD7DFA8F77C8EC12D152F942A3D99F93B1`
- [TinyRustLM](tinyrustlm-readme.md): TinyRustLM is the zero-dependency client-side SLM runtime for Runtime.MiRust.com.  
  `sha256:625BA413419244D514A72DB0881094AB151F0728D475588159E018757D923937`
- [TinyRustLM Models](tinyrustlm-models-readme.md): Static local .slm files belong here.  
  `sha256:58B136954E3227CB9B15801DF742EE36511F44A505F65B4FA148001F8B26EAA8`
- [Runtime.MiRust.com Browser Harness Architecture](browser-harness.md): Reviewed: 2026-06-24  
  `sha256:DA41833332FC07E395ED34EFF3938D04AE341CABCCE5F8F692FF31B5FF2EF5B0`
- [AIWikis Routing Plan](aiwikis-routing.md): Reviewed: 2026-06-24  
  `sha256:42B0FB6654EB978F0441F393E6B0F313FB8CBC7365E978C0534A202D3CBC8732`
- [Visual Studio Setup](visual-studio.md): Open TinyRustLM.sln from the repository root in Visual Studio 2022.  
  `sha256:4EB9659BEBD8C33799A384DEE81415BCCB13304F2D2E67CFDC1A3D0D9976ABDB`
