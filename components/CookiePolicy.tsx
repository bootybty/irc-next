'use client';

import { useTheme, themes } from './ThemeProvider';

interface CookiePolicyProps {
  onClose: () => void;
  onBack: () => void;
}

export default function CookiePolicy({ onClose, onBack }: CookiePolicyProps) {
  const { theme } = useTheme();
  const currentTheme = themes[theme];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
      <div className={`${currentTheme.modal} ${currentTheme.border} border p-6 max-w-4xl w-full max-h-[90vh] overflow-auto`} style={{
        scrollbarWidth: 'thin',
        scrollbarColor: currentTheme.scrollbar
      }}>
        <div className={`${currentTheme.text} font-mono text-sm`}>
          <div className="flex justify-between items-center mb-6">
            <div className={`${currentTheme.accent} text-lg`}>
              === COOKIE POLICY ===
            </div>
            <button
              onClick={onClose}
              className={`${currentTheme.error} ${currentTheme.button} px-3 py-1`}
            >
              [CLOSE]
            </button>
          </div>

          <button
            onClick={onBack}
            className={`${currentTheme.accent} ${currentTheme.button} mb-4`}
          >
            ← BACK
          </button>

          <div className="space-y-6">
            <section>
              <h3 className={`${currentTheme.highlight} font-bold mb-2`}>WHAT ARE COOKIES?</h3>
              <div className={`${currentTheme.text} text-xs leading-relaxed`}>
                Cookies are small text files stored on your device when you visit a website. 
                They help us remember your preferences and improve your experience.
              </div>
            </section>

            <section>
              <h3 className={`${currentTheme.highlight} font-bold mb-2`}>NECESSARY COOKIES</h3>
              <div className="space-y-3">
                <div className={`${currentTheme.text} text-xs`}>
                  <div className="font-bold">Supabase Session Cookies</div>
                  <div className="ml-4 space-y-1">
                    <div><strong>Name:</strong> sb-*-auth-token</div>
                    <div><strong>Purpose:</strong> Authentication and session management</div>
                    <div><strong>Duration:</strong> Session or until logout</div>
                    <div><strong>Type:</strong> HTTP-only, Secure</div>
                  </div>
                </div>
                
                <div className={`${currentTheme.text} text-xs`}>
                  <div className="font-bold">Theme Preference</div>
                  <div className="ml-4 space-y-1">
                    <div><strong>Name:</strong> irc-theme</div>
                    <div><strong>Purpose:</strong> Remember your chosen theme</div>
                    <div><strong>Duration:</strong> Permanent until deleted</div>
                    <div><strong>Type:</strong> LocalStorage</div>
                  </div>
                </div>

                <div className={`${currentTheme.text} text-xs`}>
                  <div className="font-bold">Cookie Consent</div>
                  <div className="ml-4 space-y-1">
                    <div><strong>Name:</strong> cookie-consent</div>
                    <div><strong>Purpose:</strong> Remember your cookie preferences</div>
                    <div><strong>Duration:</strong> 1 year</div>
                    <div><strong>Type:</strong> LocalStorage</div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 className={`${currentTheme.highlight} font-bold mb-2`}>ANALYTICS COOKIES (OPTIONAL)</h3>
              <div className="space-y-3">
                <div className={`${currentTheme.text} text-xs`}>
                  <div className="font-bold">Vercel Analytics</div>
                  <div className="ml-4 space-y-1">
                    <div><strong>Provider:</strong> Vercel Inc.</div>
                    <div><strong>Purpose:</strong> Anonymous usage statistics and page views</div>
                    <div><strong>Duration:</strong> 26 months</div>
                    <div><strong>Data:</strong> Page views, referrer, anonymized IP</div>
                    <div><strong>Privacy Policy:</strong> <span className={currentTheme.accent}>vercel.com/legal/privacy-policy</span></div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 className={`${currentTheme.highlight} font-bold mb-2`}>PERFORMANCE COOKIES (OPTIONAL)</h3>
              <div className="space-y-3">
                <div className={`${currentTheme.text} text-xs`}>
                  <div className="font-bold">Vercel Speed Insights</div>
                  <div className="ml-4 space-y-1">
                    <div><strong>Provider:</strong> Vercel Inc.</div>
                    <div><strong>Purpose:</strong> Measure website performance and speed</div>
                    <div><strong>Duration:</strong> Session</div>
                    <div><strong>Data:</strong> Page load times, Core Web Vitals</div>
                    <div><strong>Privacy Policy:</strong> <span className={currentTheme.accent}>vercel.com/legal/privacy-policy</span></div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 className={`${currentTheme.highlight} font-bold mb-2`}>THIRD PARTIES</h3>
              <div className={`${currentTheme.text} text-xs leading-relaxed space-y-2`}>
                <div><strong>Supabase:</strong> Database and authentication - EU-based, GDPR-compliant</div>
                <div><strong>Vercel:</strong> Hosting and analytics - USA-based with EU data centers</div>
                <div><strong>Google Fonts:</strong> Web fonts - can be cached locally by browser</div>
              </div>
            </section>

            <section>
              <h3 className={`${currentTheme.highlight} font-bold mb-2`}>CONTROLLING COOKIES</h3>
              <div className={`${currentTheme.text} text-xs leading-relaxed space-y-2`}>
                <div><strong>Browser Settings:</strong> You can block cookies in your browser</div>
                <div><strong>Preference Center:</strong> Use the info button at the bottom of the page</div>
                <div><strong>Local Data:</strong> Clear browser data to remove all cookies</div>
                <div className={`${currentTheme.muted}`}>
                  Note: Blocking necessary cookies may affect site functionality
                </div>
              </div>
            </section>

            <section>
              <h3 className={`${currentTheme.highlight} font-bold mb-2`}>DATA TRANSFERS</h3>
              <div className={`${currentTheme.text} text-xs leading-relaxed`}>
                Some services (Vercel) may transfer data to the USA under Standard Contractual Clauses (SCC) 
                and adequacy decisions. All data is processed in accordance with GDPR.
              </div>
            </section>

            <section>
              <h3 className={`${currentTheme.highlight} font-bold mb-2`}>UPDATES</h3>
              <div className={`${currentTheme.text} text-xs leading-relaxed`}>
                This cookie policy may be updated. Significant changes will be communicated 
                through the platform or on your next visit.
              </div>
            </section>
          </div>

          <div className="mt-8 pt-4 border-t border-gray-600">
            <div className={`${currentTheme.muted} text-xs text-center`}>
              Last updated: {new Date().toLocaleDateString('en-US')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}