# Design System

品牌主色 #123f36，互動綠 #246555，米白 #f7f7ef，淺綠 #e5eee7，正文 #223d35，次要文 #61756b，點綴金 #bd9462。金色僅用裝飾。正文 14–16px、行高 1.8；H1 46–68px、H2 28–36px；系統繁中文字型。

容器 max 1200px；桌面邊距 40px、手機 20px；section 60–100px；卡片 8px 圓角，主要操作 5px。ActionLink/SectionHeading/EmptyState 統一實作。Homepage data 在 src/lib/content.ts，未接 CMS。

斷點 600/850/1100px。所有互動可鍵盤操作、focus ring、skip link、nav landmark、button accessible name。decorative elements aria-hidden。支援 prefers-reduced-motion，hover 不承載必要資訊。禁止以無效按鈕呈現未完成服務。
