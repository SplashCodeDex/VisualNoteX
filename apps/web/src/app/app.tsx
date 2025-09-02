import { useState, useEffect } from 'react';
import { initializeData } from './initialize-data';
import { Drawnix } from '@drawnix/drawnix';
import { PlaitBoard, PlaitElement, PlaitTheme, Viewport } from '@plait/core';
import localforage from 'localforage';

// 1个月后移出删除兼容
const OLD_DRAWNIX_LOCAL_DATA_KEY = 'drawnix-local-data';
const MAIN_BOARD_CONTENT_KEY = 'main_board_content';

localforage.config({
  name: 'CodeDeX VisualNoteX',
  storeName: 'codedex_visualnotex_store',
  driver: [localforage.INDEXEDDB, localforage.LOCALSTORAGE],
});

interface LicenseInfo {
  key: string;
  activated: boolean;
  expiry_date?: string;
  license_type: string;
}

// CodeDeX custom initialization info
console.log('🎨 CodeDeX VisualNoteX - Loading user workspace...');

export function App() {
  const [value, setValue] = useState<{
    children: PlaitElement[];
    viewport?: Viewport;
    theme?: PlaitTheme;
  }>({ children: [] });
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [showLicenseDialog, setShowLicenseDialog] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const storedData = await localforage.getItem(MAIN_BOARD_CONTENT_KEY);
      if (storedData) {
        setValue(storedData as any);
        return;
      }
      const localData = localStorage.getItem(OLD_DRAWNIX_LOCAL_DATA_KEY);
      if (localData) {
        const parsedData = JSON.parse(localData);
        setValue(parsedData);
        await localforage.setItem(MAIN_BOARD_CONTENT_KEY, parsedData);
        localStorage.removeItem(OLD_DRAWNIX_LOCAL_DATA_KEY);
        return;
      }
      setValue({ children: initializeData });
    };

    const checkLicense = async () => {
      try {
        // Only try Tauri API if running in desktop environment
        if ((window as any).__TAURI__) {
          const { invoke } = await import('@tauri-apps/api/tauri');
          const license = await (invoke as any)('get_license_info');
          setLicenseInfo(license);
          if (!license || !license.activated) {
            console.log('🎁 CodeDeX License Check - No active license found, prompting trial');
            setShowLicenseDialog(true);
          }
        } else {
          // Web fallback - show trial dialog
          console.log('🎨 Running in web mode - showing license dialog');
          setShowLicenseDialog(true);
        }
      } catch (error) {
        console.error('❌ Failed to check license:', error);
        setShowLicenseDialog(true);
      }
    };

    loadData();
    checkLicense();
  }, []);

  const handleStartTrial = async () => {
    try {
      if (!(window as any).__TAURI__) {
        alert('Trial licenses are only available in the desktop application.');
        return;
      }
      console.log('🎁 Starting CodeDeX Trial...');
      const { invoke } = await import('@tauri-apps/api/tauri');
      const license = await (invoke as any)('start_trial');
      setLicenseInfo(license);
      setShowLicenseDialog(false);
      console.log('✅ CodeDeX Trial activated successfully!');
    } catch (error) {
      console.error('❌ Failed to start trial:', error);
      alert('Failed to start trial. Please try again.');
    }
  };

  const handleActivateLicense = async (licenseKey: string) => {
    try {
      if (!(window as any).__TAURI__) {
        alert('License activation is only available in the desktop application.');
        return;
      }
      const { invoke } = await import('@tauri-apps/api/tauri');
      const isValid = await (invoke as any)('validate_license', { licenseKey });
      if (isValid) {
        const updatedLicense = await (invoke as any)('get_license_info');
        setLicenseInfo(updatedLicense);
        setShowLicenseDialog(false);
        console.log('✅ CodeDeX License activated successfully!');
        alert('License activated successfully! Professional features unlocked.');
      } else {
        alert('Invalid license key. Please check your key and try again.');
      }
    } catch (error) {
      console.error('❌ Failed to validate license:', error);
      alert('Failed to validate license. Please try again.');
    }
  };

  return (
    <div className="codedex-app">
      {/* CodeDeX License Status Banner */}
      {licenseInfo && (
        <div className="codedex-license-banner">
          {licenseInfo.activated ? (
            <div className="codedex-license-active">
              🎉 CodeDeX {licenseInfo.license_type.toUpperCase()} License Active
              {licenseInfo.expiry_date && (
                <span> - Expires: {licenseInfo.expiry_date}</span>
              )}
            </div>
          ) : (
            <div className="codedex-license-inactive">
              ⚠️ CodeDeX License Not Activated - Trial Required
            </div>
          )}
        </div>
      )}

      <Drawnix
        value={value.children}
        viewport={value.viewport}
        theme={value.theme}
        onChange={(changeData) => {
          // CodeDeX custom change handling with error protection
          try {
            const updatedValue = typeof changeData === 'object' && 'children' in changeData
              ? changeData
              : { children: value.children, viewport: value.viewport, theme: value.theme };

            localforage.setItem(MAIN_BOARD_CONTENT_KEY, updatedValue);
            setValue(updatedValue);

            // CodeDeX debug logging in development
            if (import.meta.env.DEV && Math.random() < 0.01) {
              console.log('🎨 Auto-saving workspace - CodeDeX VisualNoteX');
            }
          } catch (error) {
            console.error('💥 CodeDeX error: Failed to save workspace changes', error);
          }
        }}
        afterInit={(board) => {
          console.log('board initialized');
          console.log(
            `add __drawnix__web__debug_log to window, so you can call add log anywhere, like: window.__drawnix__web__console('some thing')`
          );
          (window as any)['__drawnix__web__console'] = (value: string) => {
            addDebugLog(board, value);
          };
        }}
      ></Drawnix>

      {/* CodeDeX License Activation Dialog */}
      {showLicenseDialog && (
        <div className="codedex-license-dialog-overlay">
          <div className="codedex-license-dialog">
            <h2>🎨 Welcome to CodeDeX VisualNoteX</h2>
            <p>Your professional drawing and whiteboarding application</p>

            <div className="codedex-license-options">
              <div className="codedex-trial-section">
                <h3>🚀 Free 30-Day Professional Trial</h3>
                <p>Experience all features including:</p>
                <ul>
                  <li>Advanced drawing tools</li>
                  <li>Unlimited diagrams</li>
                  <li>Professional export options</li>
                  <li>Cloud sync capabilities</li>
                </ul>
                <button
                  className="codedex-trial-button"
                  onClick={handleStartTrial}
                >
                  Start Free Trial
                </button>
              </div>

              <div className="codedex-license-section">
                <h3>💎 Have a License Key?</h3>
                <LicenseActivationForm onActivate={handleActivateLicense} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const addDebugLog = (board: PlaitBoard, value: string) => {
  const container = PlaitBoard.getBoardContainer(board).closest(
    '.drawnix'
  ) as HTMLElement;
  let consoleContainer = container.querySelector('.drawnix-console');
  if (!consoleContainer) {
    consoleContainer = document.createElement('div');
    consoleContainer.classList.add('drawnix-console');
    container.append(consoleContainer);
  }
  const div = document.createElement('div');
  div.innerHTML = value;
  consoleContainer.append(div);
};

// CodeDeX License Activation Form Component
interface LicenseActivationFormProps {
  onActivate: (licenseKey: string) => Promise<void>;
}

const LicenseActivationForm: React.FC<LicenseActivationFormProps> = ({ onActivate }) => {
  const [licenseKey, setLicenseKey] = useState('');
  const [isActivating, setIsActivating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKey.trim()) return;

    setIsActivating(true);
    try {
      await onActivate(licenseKey);
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="codedex-license-form">
      <div className="codedex-license-input-group">
        <label htmlFor="licenseKey">License Key:</label>
        <input
          id="licenseKey"
          type="text"
          value={licenseKey}
          onChange={(e) => setLicenseKey(e.target.value)}
          placeholder="Enter your CodeDeX license key"
          disabled={isActivating}
          required
        />
      </div>
      <button
        type="submit"
        className="codedex-activate-button"
        disabled={isActivating || !licenseKey.trim()}
      >
        {isActivating ? '🔄 Activating...' : '💎 Activate License'}
      </button>
      <div className="codedex-license-help">
        <small>• Find your license key in your CodeDeX customer portal</small>
        <small>• Keys contain "CODEDEX" and are at least 20 characters long</small>
      </div>
    </form>
  );
};

export default App;
