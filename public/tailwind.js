tailwind.config = {
    darkMode: "class",
    theme: {
        extend: {
            "colors": {
                // Colores personalizados de la marca LuxuriaPure
                "navy": "#0f172a",
                "gold": "#b89728",
                "gold-light": "#d4af37",
                
                "on-tertiary-fixed-variant": "#6e3820",
                "surface-bright": "#fbf9f8",
                "on-secondary-container": "#626361",
                "secondary-fixed-dim": "#c7c6c4",
                "on-secondary-fixed-variant": "#464745",
                "inverse-primary": "#b4cdb8",
                "surface-container": "#efeded",
                "primary-fixed-dim": "#b4cdb8",
                "on-primary-container": "#819986",
                "on-surface-variant": "#434843",
                "surface-variant": "#e4e2e2",
                "surface-container-high": "#eae8e7",
                "primary": "#0f172a", // Actualizado a Navy principal
                "on-tertiary-fixed": "#360f00",
                "tertiary-container": "#4c1e08",
                "on-primary": "#ffffff",
                "on-secondary": "#ffffff",
                "outline-variant": "#c3c8c1",
                "tertiary-fixed": "#ffdbcd",
                "on-surface": "#1b1c1c",
                "on-primary-fixed": "#0b2013",
                "secondary-container": "#e0e0dd",
                "surface-container-highest": "#e4e2e2",
                "on-tertiary": "#ffffff",
                "on-error-container": "#93000a",
                "on-tertiary-container": "#c88265",
                "inverse-surface": "#303030",
                "surface-container-low": "#f5f3f3",
                "primary-fixed": "#d0e9d4",
                "secondary-fixed": "#e3e2e0",
                "surface": "#fbf9f8",
                "background": "#fbf9f8",
                "tertiary-fixed-dim": "#ffb597",
                "surface-dim": "#dbd9d9",
                "surface-container-lowest": "#ffffff",
                "error-container": "#ffdad6",
                "on-secondary-fixed": "#1a1c1a",
                "on-background": "#1b1c1c",
                "on-error": "#ffffff",
                "inverse-on-surface": "#f2f0f0",
                "surface-tint": "#4d6453",
                "primary-container": "#0f172a",
                "tertiary": "#2f0c00",
                "error": "#ba1a1a",
                "on-primary-fixed-variant": "#364c3c",
                "outline": "#737973",
                "secondary": "#5e5f5d"
            },
            "borderRadius": {
                "DEFAULT": "0.125rem",
                "lg": "0.25rem",
                "xl": "0.5rem",
                "full": "0.75rem"
            },
            "spacing": {
                "unit": "8px",
                "container-max": "1280px",
                "gutter": "32px",
                "margin-mobile": "24px",
                "section-gap": "128px",
                "margin-desktop": "64px"
            },
            "fontFamily": {
                "serif": ["Georgia", "Cambria", "serif"], // Añadida fuente serif para la marca
                "headline-md": ["Hanken Grotesk"],
                "display-lg-mobile": ["Hanken Grotesk"],
                "display-lg": ["Hanken Grotesk"],
                "label-caps": ["Hanken Grotesk"],
                "headline-lg-mobile": ["Hanken Grotesk"],
                "body-lg": ["Hanken Grotesk"],
                "body-md": ["Hanken Grotesk"],
                "headline-lg": ["Hanken Grotesk"],
                "headline-sm": ["Hanken Grotesk"]
            },
            "fontSize": {
                "headline-md": ["32px", { "lineHeight": "1.3", "letterSpacing": "0em", "fontWeight": "400" }],
                "display-lg-mobile": ["42px", { "lineHeight": "1.1", "fontWeight": "300" }],
                "display-lg": ["64px", { "lineHeight": "1.1", "letterSpacing": "-0.02em", "fontWeight": "300" }],
                "label-caps": ["12px", { "lineHeight": "1", "letterSpacing": "0.15em", "fontWeight": "600" }],
                "headline-lg-mobile": ["36px", { "lineHeight": "1.2", "fontWeight": "400" }],
                "body-lg": ["20px", { "lineHeight": "1.6", "letterSpacing": "0em", "fontWeight": "400" }],
                "body-md": ["16px", { "lineHeight": "1.6", "letterSpacing": "0em", "fontWeight": "400" }],
                "headline-lg": ["48px", { "lineHeight": "1.2", "letterSpacing": "-0.01em", "fontWeight": "400" }],
                "headline-sm": ["24px", { "lineHeight": "1.4", "letterSpacing": "0.02em", "fontWeight": "500" }]
            }
        }
    }
}