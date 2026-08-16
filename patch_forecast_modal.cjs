const fs = require('fs');
let code = fs.readFileSync('src/components/ForecastImageModal.tsx', 'utf8');

code = code.replace(
  `  config
}: ForecastImageModalProps) {
  // Requirement 8: Use historical config snapshot if available
  const activeHistoryState = typhoon.history && typhoon.history.length > 0 ? typhoon.history[Math.min(currentHour, typhoon.history.length - 1)] : null;
  const snapshotConfig = activeHistoryState?.configSnapshot || config;
  config = snapshotConfig; // Override local prop`,
  `  config: baseConfigProps
}: ForecastImageModalProps) {
  // Requirement 8: Use historical config snapshot if available
  const activeHistoryState = typhoon.history && typhoon.history.length > 0 ? typhoon.history[Math.min(currentHour, typhoon.history.length - 1)] : null;
  const config = activeHistoryState?.configSnapshot || baseConfigProps;
`
);

fs.writeFileSync('src/components/ForecastImageModal.tsx', code);
