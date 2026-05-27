# Third-party notices

This demo combines mature frontend libraries for the HTML-to-PDF pipeline.

- `html2canvas@1.4.1`: installed from npm and bundled by Vite.
- `jspdf@4.2.1`: installed from npm and bundled by Vite.
- `pagedjs@0.4.3`: installed from npm. The browser polyfill is vendored at `public/vendor/paged.polyfill.js` so the demo does not depend on a runtime CDN for pagination. See `public/vendor/PAGEDJS_LICENSE.md`.

When integrating into a production product, review each dependency license against your organization's compliance process.
