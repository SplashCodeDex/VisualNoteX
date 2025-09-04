import { useState, useEffect } from 'react';
import { initializeData } from './initialize-data';
import { Drawnix, DeXStudiosSplashScreen } from '@drawnix/drawnix';
import { PlaitBoard, PlaitElement, PlaitTheme, Viewport } from '@plait/core';
import localforage from 'localforage';

// 1个月后移出删除兼容
const OLD_DRAWNIX_LOCAL_DATA_KEY = 'drawnix-local-data';
const MAIN_BOARD_CONTENT_KEY = 'main_board_content';

localforage.config({
  name: 'DeXStudios VisualPlanX',
  storeName: 'dexstudios_visualplanx_store',
  driver: [localforage.INDEXEDDB, localforage.LOCALSTORAGE],
});

interface LicenseInfo {
  key: string;
  activated: boolean;
  expiry_date?: string;
  license_type: string;
}

// DeXStudios custom initialization info
console.log('🚀 DeXStudios VisualPlanX - Loading user workspace...');

// Dynamic Tauri API loader to avoid static import analysis
const loadTauriAPI = async () => {
  try {
    // Use dynamic string to avoid static analysis
    const moduleName = '@tauri-apps/api/tauri';
    const tauriModule = await import(/* @vite-ignore */ moduleName);
    return tauriModule;
  } catch (error) {
    console.warn('⚠️ Tauri API not available:', error);
    return null;
  }
};

export function App() {
  const [value, setValue] = useState<{
    children: PlaitElement[];
    viewport?: Viewport;
    theme?: PlaitTheme;
  }>({ children: [] });
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [showLicenseDialog, setShowLicenseDialog] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

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
          const tauriModule = await loadTauriAPI();
          if (tauriModule) {
            const { invoke } = tauriModule;
            const license = await (invoke as any)('get_license_info');
            setLicenseInfo(license);
            if (!license || !license.activated) {
              console.log('🎁 DeXStudios License Check - No active license found, prompting trial');
              setShowLicenseDialog(true);
            }
          } else {
            console.warn('⚠️ Tauri module could not be loaded');
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
      console.log('🎁 Starting DeXStudios Trial...');
      const tauriModule = await loadTauriAPI();
      if (tauriModule) {
        const { invoke } = tauriModule;
        const license = await (invoke as any)('start_trial');
        setLicenseInfo(license);
        setShowLicenseDialog(false);
        console.log('✅ DeXStudios Trial activated successfully!');
      } else {
        alert('Tauri API not available. Please try again.');
      }
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
      const tauriModule = await loadTauriAPI();
      if (tauriModule) {
        const { invoke } = tauriModule;
        const isValid = await (invoke as any)('validate_license', { licenseKey });
        if (isValid) {
          const updatedLicense = await (invoke as any)('get_license_info');
          setLicenseInfo(updatedLicense);
          setShowLicenseDialog(false);
          console.log('✅ DeXStudios License activated successfully!');
          alert('License activated successfully! Professional features unlocked.');
        } else {
          alert('Invalid license key. Please check your key and try again.');
        }
      } else {
        alert('Tauri API not available. Please try again.');
      }
    } catch (error) {
      console.error('❌ Failed to validate license:', error);
      alert('Failed to validate license. Please try again.');
    }
  };

  const handleSplashComplete = () => {
    setShowSplash(false);
    console.log('🎉 DeXStudios VisualPlanX - Ready to create!');
  };

  return (
    <>
      {/* DeXStudios Splash Screen */}
      {showSplash && (
        <DeXStudiosSplashScreen
          onComplete={handleSplashComplete}
          duration={3500}
          showProgress={true}
        />
      )}

      {/* Main Application */}
      {!showSplash && (
        <div className="dexstudios-app">
          {/* DeXStudios License Status Banner */}
          {licenseInfo && (
            <div className="dexstudios-license-banner">
              {licenseInfo.activated ? (
                <div className="dexstudios-license-active">
                  🎉 DeXStudios {licenseInfo.license_type.toUpperCase()} License Active
                  {licenseInfo.expiry_date && (
                    <span> - Expires: {licenseInfo.expiry_date}</span>
                  )}
                </div>
              ) : (
                <div className="dexstudios-license-inactive">
                  ⚠️ DeXStudios License Not Activated - Trial Required
                </div>
              )}
            </div>
          )}

          <Drawnix
            value={value.children}
            viewport={value.viewport}
            theme={value.theme}
            onChange={(changeData) => {
              // DeXStudios custom change handling with error protection
              try {
                const updatedValue = typeof changeData === 'object' && 'children' in changeData
                  ? changeData
                  : { children: value.children, viewport: value.viewport, theme: value.theme };

                localforage.setItem(MAIN_BOARD_CONTENT_KEY, updatedValue);
                setValue(updatedValue);

                // DeXStudios debug logging in development
                if (import.meta.env.DEV && Math.random() < 0.01) {
                  console.log('🚀 Auto-saving workspace - DeXStudios VisualPlanX');
                }
              } catch (error) {
                console.error('💥 DeXStudios error: Failed to save workspace changes', error);
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
          />

          {/* DeXStudios License Activation Dialog */}
          {showLicenseDialog && (
            <div className="dexstudios-license-dialog-overlay">
              <div className="dexstudios-license-dialog">
                <h2>🚀 Welcome to DeXStudios VisualPlanX</h2>
                <p>Your enterprise-grade diagramming and whiteboarding platform</p>

                <div className="dexstudios-license-options">
                  <div className="dexstudios-trial-section">
                    <h3>🎯 Free 30-Day Enterprise Trial</h3>
                    <p>Experience all professional features including:</p>
                    <ul>
                      <li>Advanced performance-optimized drawing tools</li>
                      <li>Enterprise-grade diagramming capabilities</li>
                      <li>Professional export and collaboration options</li>
                      <li>Performance monitoring and analytics</li>
                    </ul>
                    <button
                      className="dexstudios-trial-button"
                      onClick={handleStartTrial}
                    >
                      Start Enterprise Trial
                    </button>
                  </div>

                  <div className="dexstudios-license-section">
                    <h3>💎 Have a License Key?</h3>
                    <LicenseActivationForm onActivate={handleActivateLicense} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
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

// DeXStudios License Activation Form Component
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
    <form onSubmit={handleSubmit} className="dexstudios-license-form">
      <div className="dexstudios-license-input-group">
        <label htmlFor="licenseKey">License Key:</label>
        <input
          id="licenseKey"
          type="text"
          value={licenseKey}
          onChange={(e) => setLicenseKey(e.target.value)}
          placeholder="Enter your DeXStudios license key"
          disabled={isActivating}
          required
        />
      </div>
      <button
        type="submit"
        className="dexstudios-activate-button"
        disabled={isActivating || !licenseKey.trim()}
      >
        {isActivating ? '🔄 Activating...' : '💎 Activate Enterprise License'}
      </button>
      <div className="dexstudios-license-help">
        <small>• Find your license key in your DeXStudios customer portal</small>
        <small>• Keys contain "DEXSTUDIOS" and are at least 20 characters long</small>
        <small>• Contact: splashdexstudios@gmail.com | +233533365712</small>
      </div>
    </form>
  );
};

export default App;