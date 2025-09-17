'use client';

import { useTheme, themes } from './ThemeProvider';

interface PrivacyPolicyProps {
  onClose: () => void;
  onBack: () => void;
}

export default function PrivacyPolicy({ onClose, onBack }: PrivacyPolicyProps) {
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
              === PRIVACY POLICY ===
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
              <h3 className={`${currentTheme.highlight} font-bold mb-2`}>1. DATA CONTROLLER</h3>
              <div className={`${currentTheme.text} text-xs leading-relaxed`}>
                This IRC chat application is developed as a project. For questions about data processing, 
                contact us via the GitHub repository or email.
              </div>
            </section>

            <section>
              <h3 className={`${currentTheme.highlight} font-bold mb-2`}>2. WHAT DATA WE COLLECT</h3>
              <div className={`${currentTheme.text} text-xs leading-relaxed space-y-2`}>
                <div><strong>User Profile:</strong> Email, username, avatar URL (optional), bio (optional)</div>
                <div><strong>Chat Data:</strong> Messages, timestamps, channel membership</div>
                <div><strong>Session Data:</strong> Login status, current channel, last activity</div>
                <div><strong>Technical Data:</strong> IP address (temporary), browser type, device info</div>
                <div><strong>Analytics:</strong> Page views, user interactions (only with consent)</div>
              </div>
            </section>

            <section>
              <h3 className={`${currentTheme.highlight} font-bold mb-2`}>3. PURPOSE OF DATA PROCESSING</h3>
              <div className={`${currentTheme.text} text-xs leading-relaxed space-y-2`}>
                <div><strong>Service Delivery:</strong> Provide chat functionality and user experience</div>
                <div><strong>Authentication:</strong> Verify identity and secure access</div>
                <div><strong>Security:</strong> Prevent abuse and spam</div>
                <div><strong>Improvement:</strong> Analyze usage to improve the service (only with consent)</div>
              </div>
            </section>

            <section>
              <h3 className={`${currentTheme.highlight} font-bold mb-2`}>4. LEGAL BASIS</h3>
              <div className={`${currentTheme.text} text-xs leading-relaxed space-y-2`}>
                <div><strong>Contract:</strong> Necessary data to provide the chat service</div>
                <div><strong>Consent:</strong> Analytics and performance tracking</div>
                <div><strong>Legitimate Interest:</strong> Security and anti-spam measures</div>
              </div>
            </section>

            <section>
              <h3 className={`${currentTheme.highlight} font-bold mb-2`}>5. DATA RETENTION</h3>
              <div className={`${currentTheme.text} text-xs leading-relaxed space-y-2`}>
                <div><strong>User Profile:</strong> Until account deletion</div>
                <div><strong>Chat Messages:</strong> Permanent (can be deleted upon request)</div>
                <div><strong>Session Data:</strong> 30 days after last activity</div>
                <div><strong>Analytics Data:</strong> 26 months (Vercel standard)</div>
              </div>
            </section>

            <section>
              <h3 className={`${currentTheme.highlight} font-bold mb-2`}>6. THIRD PARTIES</h3>
              <div className={`${currentTheme.text} text-xs leading-relaxed space-y-2`}>
                <div><strong>Supabase:</strong> Database and authentication (EU-based)</div>
                <div><strong>Vercel:</strong> Hosting and analytics (GDPR-compliant)</div>
                <div><strong>Google Fonts:</strong> Web fonts (can be loaded locally)</div>
              </div>
            </section>

            <section>
              <h3 className={`${currentTheme.highlight} font-bold mb-2`}>7. YOUR RIGHTS</h3>
              <div className={`${currentTheme.text} text-xs leading-relaxed space-y-2`}>
                <div><strong>Access:</strong> See what data we have about you</div>
                <div><strong>Rectification:</strong> Update incorrect information</div>
                <div><strong>Erasure:</strong> Delete your account and data</div>
                <div><strong>Data Portability:</strong> Export your data</div>
                <div><strong>Consent:</strong> Withdraw consent at any time</div>
                <div><strong>Complaint:</strong> File a complaint with data protection authorities</div>
              </div>
            </section>

            <section>
              <h3 className={`${currentTheme.highlight} font-bold mb-2`}>8. SECURITY</h3>
              <div className={`${currentTheme.text} text-xs leading-relaxed`}>
                We use industry-standard security measures including encryption, 
                secure connections (HTTPS), and regular security updates. 
                All data is stored in EU-based data centers.
              </div>
            </section>

            <section>
              <h3 className={`${currentTheme.highlight} font-bold mb-2`}>9. CHANGES</h3>
              <div className={`${currentTheme.text} text-xs leading-relaxed`}>
                We reserve the right to update this policy. 
                Significant changes will be communicated via the platform.
              </div>
            </section>

            <section>
              <h3 className={`${currentTheme.highlight} font-bold mb-2`}>10. CONTACT</h3>
              <div className={`${currentTheme.text} text-xs leading-relaxed`}>
                For questions about data processing or to exercise your rights, 
                contact us via the project&apos;s GitHub repository.
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