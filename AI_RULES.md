# Tech Stack

- You are building a React application.
- Use TypeScript.
- Use React Router. KEEP the routes in src/App.tsx
- Always put source code in the src folder.
- Put pages into src/pages/
- Put components into src/components/
- The main page (default page) is src/pages/Index.tsx
- UPDATE the main page to include the new components. OTHERWISE, the user can NOT see any components!
- ALWAYS try to use the shadcn/ui library.
- Tailwind CSS: always use Tailwind CSS for styling components. Utilize Tailwind classes extensively for layout, spacing, colors, and other design aspects.

Available packages and libraries:

- The lucide-react package is installed for icons.
- You ALREADY have ALL the shadcn/ui components and their dependencies installed. So you don't need to install them again.
- You have ALL the necessary Radix UI components installed.
- Use prebuilt components from the shadcn/ui library after importing them. Note that these files shouldn't be edited, so make new components if you need to change them.

# Architecture Notes

- App: Aziz Revenue - Arabic RTL rental/property revenue management PWA/Capacitor app.
- Data stored locally via localStorage (store key: `aziz-revenue-data-v2`).
- Store provider: `src/data/store.tsx` with `useStore()` hook. Data migration from v1 supported.
- Types: `src/data/types.ts` - entities: Building, Unit, Tenant, Contract, Payment, Bill, Repair, TenantRequest, Settings.
- Business logic: `src/data/helpers.ts` - central functions: calculateUnitStatus, calculateContractStatus, generatePaymentSchedule, generatePaymentsForContract, regenerateContractPayments, calculateCollectionFee, calculateOwnerNet, buildingStats, globalStats, collectReminders.
- Unit status is AUTO-CALCULATED from contracts, not manually set. Use `calculateUnitStatus(unit, contracts)`.
- Payments are AUTO-GENERATED when contracts are saved. Use `generatePaymentsForContract()` / `regenerateContractPayments()`.
- Bottom nav has 6 tabs: الرئيسية, العقارات, الدفعات, الطلبات, التقارير, الإعدادات.
- Android back button handled via `src/hooks/useBackButton.ts`.
- Toast notifications use top-center position, 2-3s duration (sonner).
- Safe areas handled via CSS utilities: `.pb-safe`, `.pt-safe`, `.pb-safe-nav`, `.sheet-safe-bottom`.
