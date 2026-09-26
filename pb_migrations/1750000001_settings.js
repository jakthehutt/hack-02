/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const settings = app.settings()
  settings.meta.appName = "Narrative pipeline"
  settings.meta.appURL = "http://127.0.0.1:8090"
  settings.batch.enabled = true
  settings.batch.maxRequests = 50
  settings.batch.timeout = 120
  app.save(settings)
}, (app) => {
  const settings = app.settings()
  settings.batch.enabled = false
  app.save(settings)
})
