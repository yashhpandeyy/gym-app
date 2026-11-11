// Wrangler bundles .html imports as plain text (its default module rules), which is how the
// console and reset pages ship inside the Worker.
declare module '*.html' {
  const html: string;
  export default html;
}
