import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

const section = "space-y-3 pb-8 border-b border-gray-100 last:border-0";
const heading = "text-lg font-semibold text-indigo-700 pb-1";
const note = "text-sm text-gray-500";
const badge = "inline bg-gray-100 text-gray-500 rounded px-1.5 py-0.5 text-xs font-mono";
const btnCls = "bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors";
const monoBox = "text-sm bg-gray-50 rounded px-3 py-2 text-gray-600 font-mono";

export default function IntegrationTimeoutsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const delayParam = searchParams.get("delay");
  const delay = delayParam !== null && delayParam !== "" ? Number(delayParam) : 1500;

  const redirectParam = searchParams.get("redirect");
  const redirect = redirectParam !== null && redirectParam !== "" ? Number(redirectParam) : null;

  const [showDelayed, setShowDelayed] = useState(false);
  const [showSubmitHeading, setShowSubmitHeading] = useState(false);
  const [showSubmitButton, setShowSubmitButton] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showCard, setShowCard] = useState(false);

  // (a), (b), (c): the delayed div, the Submit heading/button sequence, and the
  // delayed card all appear `delay` ms after mount; the button follows the
  // heading by a further 50 ms.
  useEffect(() => {
    setShowDelayed(false);
    setShowSubmitHeading(false);
    setShowSubmitButton(false);
    setSubmitted(false);
    setShowCard(false);

    const timers = [
      setTimeout(() => setShowDelayed(true), delay),
      setTimeout(() => setShowCard(true), delay),
      setTimeout(() => setShowSubmitHeading(true), delay),
      setTimeout(() => setShowSubmitButton(true), delay + 50),
    ];

    return () => timers.forEach(clearTimeout);
  }, [delay]);

  // (e): client-side navigate to ?arrived=1 after `redirect` ms, when present.
  useEffect(() => {
    if (redirect === null) return;
    const timer = setTimeout(() => {
      navigate("/integration-timeouts?arrived=1");
    }, redirect);
    return () => clearTimeout(timer);
  }, [redirect, navigate]);

  return (
    <div data-testid="integration-timeouts-page" className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">Integration Timeouts Page</h1>
      <p className="text-gray-500 text-sm mb-10">
        UI fixtures for testing selector waits and timeouts against a live page.
        Use <span className={badge}>?delay=</span> and <span className={badge}>?redirect=</span>{" "}
        to control timing.
      </p>

      <div className="space-y-10">

        {/* ── delayed content ─────────────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>Delayed element</h2>
          <p className={note}>Appears {delay}ms after mount.</p>
          {showDelayed && (
            <div data-testid="int-delayed" className={monoBox}>Delayed content</div>
          )}
        </section>

        {/* ── stability: heading then button ──────────────────────── */}
        <section className={section}>
          <h2 className={heading}>Submit stability</h2>
          <p className={note}>
            A heading reading "Submit" appears first; a button with{" "}
            <span className={badge}>data-testid=Submit</span> follows 50ms later.
            Clicking the heading does nothing; clicking the button submits.
          </p>
          {showSubmitHeading && <h3>Submit</h3>}
          {showSubmitButton && (
            <button data-testid="Submit" onClick={() => setSubmitted(true)} className={btnCls}>
              Confirm
            </button>
          )}
          {submitted && (
            <p data-testid="int-submit-result" className="text-sm text-green-600 font-medium">
              Submitted
            </p>
          )}
        </section>

        {/* ── delayed card ─────────────────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>Delayed card</h2>
          <p className={note}>A container with a nested label, appears {delay}ms after mount.</p>
          {showCard && (
            <div data-testid="int-delayed-card" className="border border-gray-200 rounded-lg p-4">
              <span data-testid="int-card-label" className="text-sm text-indigo-700 font-medium">
                Card ready
              </span>
            </div>
          )}
        </section>

        {/* ── always-hidden element ────────────────────────────────── */}
        <section className={section}>
          <h2 className={heading}>Hidden element</h2>
          <p className={note}>Always present in the DOM, never visible.</p>
          <div data-testid="int-hidden" style={{ display: "none" }}>Hidden</div>
        </section>

      </div>
    </div>
  );
}
