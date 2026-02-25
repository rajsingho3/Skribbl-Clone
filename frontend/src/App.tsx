import { useEffect, useState } from "react";
import { Home } from "./Pages/Home";
import { Room } from "./Pages/Room";

function getRouteFromHash() {
  const hash = window.location.hash || "";
  const withoutHash = hash.startsWith("#") ? hash.slice(1) : hash;
  const [pathPart] = withoutHash.split("?");
  const normalized = (pathPart || "/").toLowerCase().replace(/\/+$/, "") || "/";
  return normalized;
}

function App() {
  const [route, setRoute] = useState(getRouteFromHash());

  useEffect(() => {
    const onHashChange = () => setRoute(getRouteFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (route === "/room") {
    return <Room />;
  }

  return <Home />;
}

export default App;
