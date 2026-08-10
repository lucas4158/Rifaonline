import { memo, useCallback } from "react";
import { CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";
import { Status } from "../types";

interface NumberCellProps {
  id: string;
  status: Status;
  isGhost?: boolean;
  isSelected: boolean;
  isActiveRaffle: boolean;
  styleClasses: string;
  timerText?: string;
  onClick: (id: string, status: Status) => void;
}

export const NumberCell = memo(
  ({
    id,
    status,
    isSelected,
    isActiveRaffle,
    styleClasses,
    timerText,
    onClick,
  }: NumberCellProps) => {
    const handleLocalClick = useCallback(() => {
      onClick(id, status);
    }, [id, status, onClick]);

    return (
      <button
        onClick={handleLocalClick}
        disabled={status !== "available" && !isSelected}
        type="button"
        translate="no"
        className={`
          notranslate group relative rounded-xl sm:rounded-2xl p-1.5 sm:p-4 transition-all duration-300 border font-black min-h-[52px] sm:min-h-[80px] 
          flex flex-col items-center justify-center overflow-hidden w-full select-none
          ${styleClasses}
          ${status === "available" && isActiveRaffle ? "cursor-pointer active:scale-95 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-yellow-500/5" : "cursor-default"}
        `}
      >
        <span translate="no" className="notranslate text-sm sm:text-lg relative z-10 leading-none">{id}</span>

        {status === "paid" && (
          <span translate="no" className="notranslate text-[7px] sm:text-[9px] font-black uppercase tracking-wider text-emerald-400 mt-1 sm:mt-1.5 relative z-10 select-none text-center leading-none">
            Vendido
          </span>
        )}

        {status === "bonus_paid" && (
          <span translate="no" className="notranslate text-[7px] sm:text-[9px] font-black uppercase tracking-wider text-fuchsia-300 mt-1 sm:mt-1.5 relative z-10 select-none text-center leading-none">
            Bônus Pago
          </span>
        )}

        {(status === "pending_payment" || status === "reserved") && (
          <span translate="no" className="notranslate text-[7px] sm:text-[9px] font-black uppercase tracking-wider text-orange-400 mt-1 sm:mt-1.5 relative z-10 select-none text-center leading-none">
            Reservado
          </span>
        )}

        {status === "bonus_reserved" && (
          <span translate="no" className="notranslate text-[7px] sm:text-[9px] font-black uppercase tracking-wider text-purple-300 mt-1 sm:mt-1.5 relative z-10 select-none text-center leading-none">
            Bônus Reservado
          </span>
        )}

        {isSelected && timerText && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            translate="no"
            className="notranslate text-[8px] sm:text-[10px] mt-1 font-semibold bg-zinc-950/40 text-yellow-300 px-1.5 py-0.5 rounded-full relative z-10 text-center select-none"
          >
            {timerText}
          </motion.div>
        )}

        {status === "paid" && (
          <div className="absolute inset-0 flex items-center justify-center opacity-5 rotate-12 pointer-events-none select-none">
            <CheckCircle2 className="w-10 h-10" />
          </div>
        )}
      </button>
    );
  }
);

NumberCell.displayName = "NumberCell";
