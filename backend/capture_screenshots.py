"""Drive the running UI with Playwright and capture presentation screenshots.

Usage (with backend on :8000 and frontend on :5173 already running):

    python capture_screenshots.py

Outputs PNGs into ../presentation/screenshots/.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from playwright.async_api import Page, async_playwright

SCREENSHOTS = Path(__file__).resolve().parent.parent / "presentation" / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

VIEWPORT = {"width": 1440, "height": 900}
URL = "http://localhost:5173"

# A realistic, on-message incident — replaces the in-app default which is a bit terse.
DEMO_INCIDENT = """INC-2026-0507-001 | P1 | payments-api returning 5xx on /v1/charges
Service: payments-api
Window: 14:22-14:38 UTC, us-east-1 only
Symptoms: error rate on /v1/charges climbed from 0.1% to 6.2% in 3 minutes.
Recent change: v1.18.5 deployed at 14:10 UTC.
Logs: stack traces show NullPointerException in the retry handler on cache miss.
PagerDuty fired at 14:22. p95 latency above 4s, queue depth rising."""


async def shot(page: Page, name: str, *, full_page: bool = False) -> Path:
    out = SCREENSHOTS / f"{name}.png"
    await page.screenshot(path=str(out), full_page=full_page)
    print(f"  -> {out.relative_to(SCREENSHOTS.parent.parent)}")
    return out


async def main() -> None:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport=VIEWPORT, device_scale_factor=2)
        page = await context.new_page()

        print(f"Opening {URL} ...")
        await page.goto(URL, wait_until="networkidle")
        await page.wait_for_selector("text=Incident Management AI Copilot")

        # Replace the default sample with our richer incident.
        textbox = page.locator("textarea").first
        await textbox.click()
        await page.keyboard.press("Meta+A")
        await page.keyboard.press("Backspace")
        await textbox.fill(DEMO_INCIDENT)

        # 1. Idle state — full-page so the entire workspace is visible in the slide.
        print("Idle state ...")
        await shot(page, "01-idle-viewport")
        await shot(page, "01-idle-fullpage", full_page=True)

        # 2. Trigger the agent.
        print("Clicking Analyze Incident ...")
        await page.get_by_role("button", name="Analyze Incident").click()

        # 3. Loading state — the spinner + 'Generating analysis...' alert should be visible.
        await page.wait_for_selector("text=Generating analysis", timeout=5_000)
        await page.wait_for_timeout(400)  # let chips/spinners settle
        print("Loading state ...")
        await shot(page, "02-loading-viewport")

        # 4. Wait for the agent to finish (qwen2.5:14b warm = ~30s, allow 3 min).
        print("Waiting for analysis to complete ...")
        await page.wait_for_selector("text=Analysis complete", timeout=180_000)
        await page.wait_for_timeout(800)  # allow MUI transitions to finish

        # 5. Final populated views.
        print("Result viewport (top of page) ...")
        await shot(page, "03-result-viewport")

        print("Result full page (everything in one shot) ...")
        await shot(page, "03-result-fullpage", full_page=True)

        # 6. Zoomed cards — handy when slide layout needs a tighter crop.
        async def card_shot(card_title: str, slug: str) -> None:
            card = page.locator(f"div.MuiPaper-root:has(h2:has-text('{card_title}'))").first
            try:
                await card.scroll_into_view_if_needed()
                await page.wait_for_timeout(250)
                bbox = await card.bounding_box()
                if bbox:
                    pad = 24
                    clip = {
                        "x": max(0, bbox["x"] - pad),
                        "y": max(0, bbox["y"] - pad),
                        "width": min(VIEWPORT["width"], bbox["width"] + pad * 2),
                        "height": bbox["height"] + pad * 2,
                    }
                    out = SCREENSHOTS / f"04-card-{slug}.png"
                    await page.screenshot(path=str(out), clip=clip)
                    print(f"  -> {out.relative_to(SCREENSHOTS.parent.parent)}")
            except Exception as exc:
                print(f"  ! could not capture {card_title}: {exc}")

        for title, slug in [
            ("Summarized Issue", "summary"),
            ("Similar Past Incidents", "similar"),
            ("Suggested Resolution Steps", "steps"),
            ("RCA Report", "rca"),
        ]:
            print(f"Card: {title}")
            await card_shot(title, slug)

        # 7. Header + status alert close-up (nice for hero slide).
        header = page.locator("header.MuiAppBar-root").first
        bbox = await header.bounding_box()
        if bbox:
            await page.screenshot(
                path=str(SCREENSHOTS / "05-header.png"),
                clip={
                    "x": 0,
                    "y": 0,
                    "width": VIEWPORT["width"],
                    "height": bbox["height"] + bbox["y"],
                },
            )
            print(f"  -> presentation/screenshots/05-header.png")

        await context.close()
        await browser.close()
        print(f"\nDone. Files in {SCREENSHOTS}")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(130)
