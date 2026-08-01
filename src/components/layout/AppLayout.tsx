import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";

export default function AppLayout() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-[1600px] bg-background md:grid md:grid-cols-[6.5rem_minmax(0,1fr)] md:[direction:ltr]">
      <main className="pb-safe md:col-start-2 md:row-start-1 md:min-w-0 md:pb-0 md:[direction:rtl]">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
