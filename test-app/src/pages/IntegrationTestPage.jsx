import { useState, useEffect } from "react";

const section = "space-y-3 pb-8 border-b border-gray-100 last:border-0";
const heading = "text-lg font-semibold text-indigo-700 pb-1";
const note = "text-sm text-gray-500";
const badge = "inline bg-gray-100 text-gray-500 rounded px-1.5 py-0.5 text-xs font-mono";
const inputCls = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-full";
const btnCls = "bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors";
const monoBox = "text-sm bg-gray-50 rounded px-3 py-2 text-gray-600 font-mono";

export default function IntegrationTestPage() {
  const [tapped, setTapped] = useState(false);
  const [toggleVisible, setToggleVisible] = useState(true);
  const [dblClickCount, setDblClickCount] = useState(0);
  const [lastKey, setLastKey] = useState("No key pressed");
  const [isHovered, setIsHovered] = useState(false);
  const [pageLoadTime] = useState(() => new Date().toISOString());
  const [viewportSize, setViewportSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handler = () =>
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return (
    <div data-testid="integration-page" className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">Integration Test Page</h1>
      <p className="text-gray-500 text-sm mb-10">
        UI fixtures for testing all uivisor commands. Each section exercises one command.
      </p>

      <div className="space-y-10">

        {/* ── goto ───────────────────────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>goto</h2>
          <p className={note}>Navigate to this page to verify <span className={badge}>goto</span> works.</p>
          <p data-testid="int-goto-marker" className="text-sm text-green-600 font-medium">
            Page reached via goto
          </p>
        </section>

        {/* ── tapOn ──────────────────────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>tapOn</h2>
          <p className={note}>Click the button. Assert the result text appears.</p>
          <div className="flex items-center gap-4">
            <button
              data-testid="int-tap-btn"
              onClick={() => setTapped(true)}
              className={btnCls}
            >
              Click Me
            </button>
            {tapped && (
              <p data-testid="int-tap-result" className="text-sm text-green-600 font-medium">
                Tapped!
              </p>
            )}
          </div>
        </section>

        {/* ── inputText shorthand ────────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>inputText (shorthand)</h2>
          <p className={note}>
            Use <span className={badge}>tapOn</span> to focus, then{" "}
            <span className={badge}>inputText: "…"</span> to type.
          </p>
          <input
            data-testid="int-input-shorthand"
            type="text"
            placeholder="Tap then type…"
            className={inputCls}
          />
        </section>

        {/* ── inputText targeted ─────────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>inputText (targeted)</h2>
          <p className={note}>
            Use <span className={badge}>inputText</span> with an{" "}
            <span className={badge}>element:</span> key to type directly.
          </p>
          <input
            data-testid="int-input-targeted"
            type="text"
            placeholder="Direct targeted input…"
            className={inputCls}
          />
        </section>

        {/* ── assertVisible / assertNotVisible ───────────────────── */}
        <section className={section}>
          <h2 className={heading}>assertVisible / assertNotVisible</h2>
          <p className={note}>Toggle the element and assert its visibility state.</p>
          <div className="flex items-center gap-4">
            <button
              data-testid="int-toggle-btn"
              onClick={() => setToggleVisible((v) => !v)}
              className={btnCls}
            >
              Toggle Element
            </button>
            {toggleVisible && (
              <p data-testid="int-toggle-target" className="text-sm text-indigo-600 font-medium">
                I am visible
              </p>
            )}
          </div>
        </section>

        {/* ── assertUrl ──────────────────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>assertUrl</h2>
          <p className={note}>
            This page is at <span className={badge}>/integration</span>. Flows assert exact and wildcard URL patterns.
          </p>
          <p data-testid="int-url-marker" className={monoBox}>/integration</p>
        </section>

        {/* ── assertText ─────────────────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>assertText</h2>
          <p className={note}>Assert the exact text content of an element.</p>
          <p data-testid="int-text-content" className={monoBox}>Hello World</p>
        </section>

        {/* ── assertValue ────────────────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>assertValue</h2>
          <p className={note}>Assert the value property of an input field.</p>
          <input
            data-testid="int-value-input"
            type="text"
            defaultValue="preset-value"
            className={inputCls}
          />
        </section>

        {/* ── assertCount ────────────────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>assertCount</h2>
          <p className={note}>Assert the number of elements matching a CSS selector (3 items below).</p>
          <ul className="space-y-1">
            <li data-testid="int-count-item" className="text-sm bg-gray-50 rounded px-3 py-1.5 text-gray-700">
              Count Item One
            </li>
            <li data-testid="int-count-item" className="text-sm bg-gray-50 rounded px-3 py-1.5 text-gray-700">
              Count Item Two
            </li>
            <li data-testid="int-count-item" className="text-sm bg-gray-50 rounded px-3 py-1.5 text-gray-700">
              Count Item Three
            </li>
          </ul>
        </section>

        {/* ── assertEnabled / assertDisabled ─────────────────────── */}
        <section className={section}>
          <h2 className={heading}>assertEnabled / assertDisabled</h2>
          <p className={note}>One enabled and one disabled element for both buttons and inputs.</p>
          <div className="grid grid-cols-2 gap-3">
            <button data-testid="int-btn-enabled" className={btnCls}>
              Enabled Button
            </button>
            <button
              data-testid="int-btn-disabled"
              disabled
              className="bg-gray-200 text-gray-400 text-sm font-medium rounded-lg px-4 py-2 cursor-not-allowed"
            >
              Disabled Button
            </button>
            <input
              data-testid="int-input-enabled-field"
              type="text"
              placeholder="Enabled input"
              className={inputCls}
            />
            <input
              data-testid="int-input-disabled-field"
              type="text"
              placeholder="Disabled input"
              disabled
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 w-full"
            />
          </div>
        </section>

        {/* ── assertChecked / assertUnchecked / check / uncheck ──── */}
        <section className={section}>
          <h2 className={heading}>assertChecked / assertUnchecked / check / uncheck</h2>
          <p className={note}>Two checkboxes: one pre-checked, one pre-unchecked.</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                data-testid="int-checkbox-pre-checked"
                type="checkbox"
                defaultChecked
              />
              Initially checked
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                data-testid="int-checkbox-pre-unchecked"
                type="checkbox"
              />
              Initially unchecked
            </label>
          </div>
        </section>

        {/* ── pressKey ───────────────────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>pressKey</h2>
          <p className={note}>Focus the input, press a key, assert the key name is displayed.</p>
          <input
            data-testid="int-key-input"
            type="text"
            placeholder="Focus here, then press a key…"
            onKeyDown={(e) => setLastKey(e.key)}
            className={inputCls}
          />
          <p data-testid="int-last-key" className={monoBox}>
            Last key: {lastKey}
          </p>
        </section>

        {/* ── selectOption ───────────────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>selectOption</h2>
          <p className={note}>Select an option from the dropdown and assert the new value.</p>
          <select
            data-testid="int-select"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-full"
          >
            <option value="apple">Apple</option>
            <option value="banana">Banana</option>
            <option value="cherry">Cherry</option>
          </select>
        </section>

        {/* ── hover ──────────────────────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>hover</h2>
          <p className={note}>Hover over the element to reveal the tooltip, then assert it is visible.</p>
          <div className="relative inline-block">
            <div
              data-testid="int-hover-target"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              className="border-2 border-dashed border-indigo-300 rounded-lg px-6 py-3 text-sm text-indigo-600 cursor-default select-none"
            >
              Hover over me
            </div>
            {isHovered && (
              <div
                data-testid="int-hover-tooltip"
                className="absolute left-0 top-full mt-1 bg-indigo-600 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10"
              >
                Tooltip visible!
              </div>
            )}
          </div>
        </section>

        {/* ── doubleClick ────────────────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>doubleClick</h2>
          <p className={note}>Double-click the button to increment the counter.</p>
          <div className="flex items-center gap-4">
            <button
              data-testid="int-dblclick-target"
              onDoubleClick={() => setDblClickCount((c) => c + 1)}
              className={btnCls}
            >
              Double tap me
            </button>
            <p data-testid="int-dblclick-count" className="text-sm text-gray-600 font-mono">
              {dblClickCount} double-click(s)
            </p>
          </div>
        </section>

        {/* ── clearText ──────────────────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>clearText</h2>
          <p className={note}>Clear the pre-filled text from the input and assert the field is empty.</p>
          <input
            data-testid="int-clear-input"
            type="text"
            defaultValue="text to be cleared"
            className={inputCls}
          />
        </section>

        {/* ── scroll ─────────────────────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>scroll</h2>
          <p className={note}>
            Scroll down to move through the page. A marker at the very bottom confirms the scroll worked.
          </p>
        </section>

        {/* ── setViewport ────────────────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>setViewport</h2>
          <p className={note}>Change the viewport with a preset name or custom dimensions.</p>
          <p data-testid="int-viewport-display" className={monoBox}>
            Viewport: {viewportSize.width} × {viewportSize.height}
          </p>
        </section>

        {/* ── screenshot ─────────────────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>screenshot</h2>
          <p className={note}>Capture a screenshot of this page to a file.</p>
          <div
            data-testid="int-screenshot-target"
            className="border border-gray-200 rounded-lg p-4 bg-gray-50 text-sm text-gray-500 text-center"
          >
            Screenshot capture target
          </div>
        </section>

        {/* ── reload ─────────────────────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>reload</h2>
          <p className={note}>
            Reload the page and verify transient state is reset (e.g., the{" "}
            <span className={badge}>tapOn</span> result disappears).
          </p>
          <p data-testid="int-load-time" className={monoBox}>
            Page loaded: {pageLoadTime}
          </p>
        </section>

        {/* ── goBack / goForward ─────────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>goBack / goForward</h2>
          <p className={note}>
            Navigate away using the link below, then use{" "}
            <span className={badge}>goBack</span> and{" "}
            <span className={badge}>goForward</span> to traverse history.
          </p>
          <a
            data-testid="int-nav-away-link"
            href="/login"
            className="text-sm text-indigo-600 underline hover:text-indigo-800"
          >
            Go to Login page →
          </a>
        </section>

        {/* ── wait / waitFor ─────────────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>wait / waitFor</h2>
          <p className={note}>
            Pause execution for a fixed duration. This element confirms the page is still loaded afterwards.
          </p>
          <p data-testid="int-wait-target" className={monoBox}>
            Wait target — still here after the delay.
          </p>
        </section>

        {/* ── runFlow ────────────────────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>runFlow</h2>
          <p className={note}>
            Include a shared setup flow, then continue with assertions in the same run.
          </p>
          <p data-testid="int-runflow-marker" className={monoBox}>
            runFlow fixture element
          </p>
        </section>

        {/* Spacer + scroll bottom marker */}
        <div className="h-96 flex items-end pb-4">
          <p data-testid="int-scroll-bottom" className="text-sm text-gray-400 italic">
            ↑ Scroll target — you are at the bottom of the page.
          </p>
        </div>

      </div>
    </div>
  );
}
