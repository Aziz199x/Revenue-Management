import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";

export default function AppLayout() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-[1440px] bg-background">
      <main className="pb-safe">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
