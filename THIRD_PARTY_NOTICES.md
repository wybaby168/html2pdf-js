# Third-party notices

This demo combines mature frontend libraries for the HTML-to-PDF pipeline.

- `html2canvas@1.4.1`: runtime dependency of `@flyfish-dev/html2pdf-js`.
- `jspdf@4.2.1`: runtime dependency of `@flyfish-dev/html2pdf-js`.
- `pagedjs@0.4.3`: browser polyfill vendored at `public/vendor/paged.polyfill.js` for the demo and at `packages/html2pdf-js/vendor/paged.polyfill.js` for the npm package. See the adjacent `PAGEDJS_LICENSE.md` files.

When integrating into a production product, review each dependency license against your organization's compliance process.
