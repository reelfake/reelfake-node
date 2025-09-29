export function getOpenApiDocsHtmlString(docsUrl: string) {
  return `
    <!doctype html>
    <html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="SwaggerUI" />
        <title>SwaggerUI</title>
        <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
    </head>
    <body>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js" crossorigin></script>
        <script>
        window.onload = () => {
            window.ui = SwaggerUIBundle({
            url: "${docsUrl}",
            dom_id: '#swagger-ui',
            });
        };
        </script>
    </body>
    </html>
    `;
}

export function getOpenApiReDocsHtmlString(docsUrl: string) {
  return `
    <!doctype html>
    <html>
    <head>
        <title>Redoc</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet" />
        <style>
        body {
            margin: 0;
            padding: 0;
        }
        </style>
    </head>
    <body>
        <redoc
        spec-url="${docsUrl}"
        theme='{
            "sidebar": {
            "backgroundColor": "#263238",
            "textColor": "#ffffff"
            }
        }'
        ></redoc>
        <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
    </body>
    </html>
    `;
}
