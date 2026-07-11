import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";

export default function AppLayout() {
  return (
    <div className="mx-auto min-h-screen max-w-md bg-background">
      <main className="pb-safe">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
