const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  `const StorePage = lazyWithRetry(() =>\n  import("./components/StorePage").then((m) => ({ default: m.StorePage }))\n);`,
  `import { StorePage } from "./components/StorePage";`
);
content = content.replace(`const Login = lazyWithRetry(() => import("./admin/Login"));`, `import Login from "./admin/Login";`);
content = content.replace(`const Dashboard = lazyWithRetry(() => import("./admin/Dashboard"));`, `import Dashboard from "./admin/Dashboard";`);
content = content.replace(`const ProtectedRoute = lazyWithRetry(() => import("./admin/ProtectedRoute"));`, `import ProtectedRoute from "./admin/ProtectedRoute";`);
content = content.replace(`const RaffleAuditView = lazyWithRetry(() => import("./components/RaffleAuditView"));`, `import RaffleAuditView from "./components/RaffleAuditView";`);

fs.writeFileSync('src/App.tsx', content);
console.log('Replaced lazy imports with static imports in App.tsx');
