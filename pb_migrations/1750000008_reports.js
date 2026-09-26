/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "reports",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "slug", required: true, presentable: true, min: 1, max: 64 },
      { type: "json", name: "payload", maxSize: 5000000 },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_reports_slug ON reports (slug)",
    ],
  })
  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("reports")
  app.delete(collection)
})
