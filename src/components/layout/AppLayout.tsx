import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";

export default function AppLayout() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-[1600px] bg-background min-[500px]:grid min-[500px]:grid-cols-[5.5rem_minmax(0,1fr)] min-[500px]:[direction:ltr]">
      <main className="pb-safe min-[500px]:col-start-2 min-[500px]:row-start-1 min-[500px]:min-w-0 min-[500px]:pb-0 min-[500px]:[direction:rtl]">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
