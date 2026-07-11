import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import { useBackButton } from "@/hooks/useBackButton";

export default function AppLayout() {
  useBackButton();
  return (
    <div className="mx-auto min-h-screen max-w-md bg-background">
      <main className="pb-safe">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
