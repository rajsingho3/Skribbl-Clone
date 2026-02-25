import { Home } from "./Pages/Home";
import { Room } from "./Pages/Room";

function App() {
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, "");

  if (path === "/room") {
    return <Room />;
  }

  return <Home />;
}

export default App;
