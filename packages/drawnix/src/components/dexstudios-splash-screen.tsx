import React, { useEffect, useState } from 'react';
import './dexstudios-splash-screen.scss';

interface DeXStudiosSplashScreenProps {
  onComplete: () => void;
  duration?: number;
  showProgress?: boolean;
}

export const DeXStudiosSplashScreen: React.FC<DeXStudiosSplashScreenProps> = ({
  onComplete,
  duration = 3000,
  showProgress = true
}) => {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  const loadingSteps = [
    'Initializing DeXStudios VisualPlanX...',
    'Loading enterprise components...',
    'Connecting to workspace...',
    'Preparing your experience...',
    'Ready to create!'
  ];

  useEffect(() => {
    const startTime = Date.now();
    const stepDuration = duration / loadingSteps.length;

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / duration) * 100, 100);
      const newStep = Math.floor((elapsed / stepDuration));

      setProgress(newProgress);
      setCurrentStep(Math.min(newStep, loadingSteps.length - 1));

      if (newProgress < 100) {
        requestAnimationFrame(updateProgress);
      } else {
        // Add a small delay before completing
        setTimeout(() => {
          onComplete();
        }, 500);
      }
    };

    requestAnimationFrame(updateProgress);
  }, [duration, onComplete]);

  return (
    <div className="dexstudios-splash-screen">
      {/* Animated Background */}
      <div className="dexstudios-splash-bg">
        <div className="dexstudios-bg-pattern"></div>
        <div className="dexstudios-bg-gradient"></div>
        <div className="dexstudios-bg-particles">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="dexstudios-particle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="dexstudios-splash-content">
        {/* Animated Logo */}
        <div className="dexstudios-logo-container">
          <svg
            className="dexstudios-logo-svg"
            viewBox="0 0 200 200"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Background Circle with Gradient */}
            <defs>
              <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--dexstudios-primary)" />
                <stop offset="50%" stopColor="var(--dexstudios-secondary)" />
                <stop offset="100%" stopColor="var(--dexstudios-accent)" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            {/* Outer Ring */}
            <circle
              cx="100"
              cy="100"
              r="85"
              fill="none"
              stroke="url(#logoGradient)"
              strokeWidth="2"
              className="dexstudios-logo-ring"
            />

            {/* Inner Design - "V" for VisualPlanX */}
            <path
              d="M70 140 L85 100 L100 140 L115 100 L130 140"
              fill="none"
              stroke="url(#logoGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="dexstudios-logo-v"
              filter="url(#glow)"
            />

            {/* Connecting Lines */}
            <line
              x1="85"
              y1="100"
              x2="70"
              y2="70"
              stroke="var(--dexstudios-primary)"
              strokeWidth="2"
              className="dexstudios-logo-line"
            />
            <line
              x1="115"
              y1="100"
              x2="130"
              y2="70"
              stroke="var(--dexstudios-secondary)"
              strokeWidth="2"
              className="dexstudios-logo-line"
            />

            {/* Center Dot */}
            <circle
              cx="100"
              cy="100"
              r="3"
              fill="var(--dexstudios-accent)"
              className="dexstudios-logo-center"
            />

            {/* Orbiting Elements */}
            <circle
              cx="100"
              cy="100"
              r="60"
              fill="none"
              stroke="var(--dexstudios-primary)"
              strokeWidth="1"
              strokeDasharray="5,5"
              className="dexstudios-orbit-path"
            />

            <circle
              cx="100"
              cy="40"
              r="4"
              fill="var(--dexstudios-secondary)"
              className="dexstudios-orbit-dot"
            />
            <circle
              cx="160"
              cy="100"
              r="4"
              fill="var(--dexstudios-accent)"
              className="dexstudios-orbit-dot"
            />
            <circle
              cx="100"
              cy="160"
              r="4"
              fill="var(--dexstudios-primary)"
              className="dexstudios-orbit-dot"
            />
            <circle
              cx="40"
              cy="100"
              r="4"
              fill="var(--dexstudios-secondary)"
              className="dexstudios-orbit-dot"
            />
          </svg>

          {/* Logo Text */}
          <div className="dexstudios-logo-text">
            <h1 className="dexstudios-main-title">DeXStudios</h1>
            <h2 className="dexstudios-subtitle">VisualPlanX</h2>
            <p className="dexstudios-tagline">Enterprise-Grade Diagramming Platform</p>
          </div>
        </div>

        {/* Loading Information */}
        <div className="dexstudios-loading-info">
          <div className="dexstudios-loading-step">
            {loadingSteps[currentStep]}
          </div>

          {showProgress && (
            <div className="dexstudios-progress-container">
              <div className="dexstudios-progress-bar">
                <div
                  className="dexstudios-progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="dexstudios-progress-text">
                {Math.round(progress)}%
              </div>
            </div>
          )}
        </div>

        {/* Feature Highlights */}
        <div className="dexstudios-features">
          <div className="dexstudios-feature-item">
            <div className="dexstudios-feature-icon">🚀</div>
            <span>Performance Optimized</span>
          </div>
          <div className="dexstudios-feature-item">
            <div className="dexstudios-feature-icon">🎨</div>
            <span>Professional Design</span>
          </div>
          <div className="dexstudios-feature-item">
            <div className="dexstudios-feature-icon">🏢</div>
            <span>Enterprise Ready</span>
          </div>
        </div>

        {/* Footer */}
        <div className="dexstudios-footer">
          <div className="dexstudios-contact">
            <span>Contact: splashdexstudios@gmail.com | +233533365712</span>
          </div>
          <div className="dexstudios-version">
            <span>Version 1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeXStudiosSplashScreen;