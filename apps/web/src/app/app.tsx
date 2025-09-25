  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingStep('Loading workspace data...');
        setLoadingProgress(10);

        const storedData = await localforage.getItem(MAIN_BOARD_CONTENT_KEY);
        if (storedData) {
          setValue(storedData as any);
          setLoadingProgress(30);
          return;
        }

        const localData = localStorage.getItem(OLD_DRAWNIX_LOCAL_DATA_KEY);
        if (localData) {
          const parsedData = JSON.parse(localData);
          setValue(parsedData);
          await localforage.setItem(MAIN_BOARD_CONTENT_KEY, parsedData);
          localStorage.removeItem(OLD_DRAWNIX_LOCAL_DATA_KEY);
          setLoadingProgress(30);
          return;
        }

        setValue({ children: initializeData });
        setLoadingProgress(30);
      } catch (error) {
        console.error('Failed to load data:', error);
        setValue({ children: initializeData });
        setLoadingProgress(30);
      }
    };

    const checkLicense = async () => {
      try {
        setLoadingStep('Checking license status...');
        setLoadingProgress(40);

        // Only try Tauri API if running in desktop environment
        if ((window as any).__TAURI__) {
          const tauriModule = await loadTauriAPI();
          if (tauriModule) {
            const { invoke } = tauriModule;
            const license = await (invoke as any)('get_license_info');
            setLicenseInfo(license);
            setLoadingProgress(60);
            if (!license || !license.activated) {
              console.log('🎁 DeXStudios License Check - No active license found, prompting trial');
              setShowLicenseDialog(true);
            }
          } else {
            console.warn('⚠️ Tauri module could not be loaded');
            setShowLicenseDialog(true);
            setLoadingProgress(60);
          }
        } else {
          // Web fallback - show trial dialog
          console.log('🎨 Running in web mode - showing license dialog');
          setShowLicenseDialog(true);
          setLoadingProgress(60);
        }
      } catch (error) {
        console.error('❌ Failed to check license:', error);
        setShowLicenseDialog(true);
        setLoadingProgress(60);
      }
    };

    const initializeApp = async () => {
      try {
        setLoadingStep('Initializing application...');
        setLoadingProgress(80);

        // Simulate component initialization time
        await new Promise(resolve => setTimeout(resolve, 200));

        setLoadingProgress(100);
        setLoadingStep('Ready to create!');
        setIsAppReady(true);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setLoadingProgress(100);
        setIsAppReady(true);
      }
    };

    const initializeLoading = async () => {
      await loadData();
      await checkLicense();
      await initializeApp();
    };

    initializeLoading();
  }, []);