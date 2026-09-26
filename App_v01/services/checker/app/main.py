from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl

from app.models import CheckReport
from app.pipeline import run_check

app = FastAPI(title="EU Web Disinfo Checker", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CheckBody(BaseModel):
    url: HttpUrl
    options: dict | None = None


class BatchBody(BaseModel):
    urls: list[HttpUrl]


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/v1/check", response_model=CheckReport)
async def check_url(body: CheckBody):
    return await run_check(str(body.url), body.options)


@app.post("/v1/check/batch")
async def check_batch(body: BatchBody):
    if len(body.urls) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 URLs per batch")
    reports: list[CheckReport] = []
    for u in body.urls:
        reports.append(await run_check(str(u)))
    return {"reports": reports}
