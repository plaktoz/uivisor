import { useState } from "react";

const section = "space-y-3 pb-8 border-b border-gray-100 last:border-0";
const heading = "text-lg font-semibold text-indigo-700 pb-1";
const note = "text-sm text-gray-500";
const badge = "inline bg-gray-100 text-gray-500 rounded px-1.5 py-0.5 text-xs font-mono";
const inputCls = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-full";
const btnCls = "bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors";

export default function IntegrationWithinPage() {
  const [basicClicked, setBasicClicked] = useState(false);

  return (
    <div data-testid="integration-within-page" className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">Integration Within Test Page</h1>
      <p className="text-gray-500 text-sm mb-10">
        UI fixtures for testing the within command. Each section exercises one within scenario.
      </p>

      <div className="space-y-10">

        {/* ── within (basic) ─────────────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>within (basic)</h2>
          <p className={note}>Scope commands to a single container. Tap the button inside the box to reveal the result.</p>
          <div data-testid="int-within-basic-container" className="border border-gray-200 rounded-lg p-4">
            <button
              data-testid="int-within-basic-btn"
              onClick={() => setBasicClicked(true)}
              className={btnCls}
            >
              Click inside
            </button>
            {basicClicked && (
              <p data-testid="int-within-basic-result" className="mt-2 text-sm text-green-600 font-medium">
                Within result visible
              </p>
            )}
          </div>
        </section>

        {/* ── within (nth) ───────────────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>within (nth)</h2>
          <p className={note}>Two identical containers share the same testId. Use nth to pick one by index.</p>
          <div className="space-y-2">
            <div data-testid="int-within-row" className="border border-gray-200 rounded-lg px-4 py-3">
              <span data-testid="int-within-row-label" className="text-sm text-gray-700">Row A</span>
            </div>
            <div data-testid="int-within-row" className="border border-gray-200 rounded-lg px-4 py-3">
              <span data-testid="int-within-row-label" className="text-sm text-gray-700">Row B</span>
            </div>
          </div>
        </section>

        {/* ── within (input) ─────────────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>within (input)</h2>
          <p className={note}>Scope <span className={badge}>tapOn</span> + <span className={badge}>inputText</span> + <span className={badge}>assertValue</span> inside a container.</p>
          <div data-testid="int-within-input-container" className="border border-gray-200 rounded-lg p-4">
            <input
              data-testid="int-within-input-field"
              type="text"
              placeholder="Type inside…"
              className={inputCls}
            />
          </div>
        </section>

        {/* ── within (assertCount) ───────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>within (assertCount)</h2>
          <p className={note}>Two containers hold different numbers of items. <span className={badge}>assertCount</span> scoped to each returns the container's count, not the page total (5).</p>
          <div className="space-y-3">
            <div data-testid="int-within-count-a" className="border border-gray-200 rounded-lg p-3">
              <ul className="space-y-1">
                <li data-testid="int-within-count-item" className="text-sm text-gray-600">Item A-1</li>
                <li data-testid="int-within-count-item" className="text-sm text-gray-600">Item A-2</li>
              </ul>
            </div>
            <div data-testid="int-within-count-b" className="border border-gray-200 rounded-lg p-3">
              <ul className="space-y-1">
                <li data-testid="int-within-count-item" className="text-sm text-gray-600">Item B-1</li>
                <li data-testid="int-within-count-item" className="text-sm text-gray-600">Item B-2</li>
                <li data-testid="int-within-count-item" className="text-sm text-gray-600">Item B-3</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── within (nested) ────────────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>within (nested)</h2>
          <p className={note}>An outer container holds an inner container. Use two nested <span className={badge}>within</span> blocks to reach the deeply nested element.</p>
          <div data-testid="int-within-outer" className="border border-gray-200 rounded-lg p-4">
            <div data-testid="int-within-inner" className="border border-dashed border-indigo-300 rounded p-3">
              <p data-testid="int-within-deep-target" className="text-sm text-indigo-700 font-medium">
                Deep target
              </p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
