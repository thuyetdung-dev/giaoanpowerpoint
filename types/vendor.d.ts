declare module "mammoth/mammoth.browser" {
  export function extractRawText(input:{arrayBuffer:ArrayBuffer}):Promise<{value:string;messages:unknown[]}>;
}

declare module "pptxgenjs/dist/pptxgen.bundle.js" {
  const PptxGenJS: any;
  export default PptxGenJS;
}
