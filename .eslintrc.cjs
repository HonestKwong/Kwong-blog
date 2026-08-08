module.exports = {
  root: true,
  extends: ["next/core-web-vitals"],
  plugins: ["boundaries"],
  settings: {
    "boundaries/elements": [
      { type: "app", pattern: "src/app/*" },
      { type: "core", pattern: "src/core/*" },
      { type: "modules", pattern: "src/modules/*", capture: ["moduleName"] },
    ],
  },
  rules: {
    "boundaries/dependencies": [
      2,
      {
        default: "disallow",
        policies: [
          {
            from: { element: { type: "app" } },
            allow: [
              { to: { element: { type: "core" } } },
              { to: { element: { type: "modules" } } },
            ],
          },
          {
            from: { element: { type: "core" } },
            allow: [{ to: { element: { type: "core" } } }],
          },
          {
            from: { element: { type: "modules" } },
            allow: [
              { to: { element: { type: "core" } } },
              {
                to: {
                  element: {
                    type: "modules",
                    captured: { moduleName: "{{from.element.captured.moduleName}}" },
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  },
};
