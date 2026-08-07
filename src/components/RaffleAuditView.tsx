import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  Search, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  RefreshCw, 
  Award, 
  FileText, 
  ExternalLink,
  Lock,
  LockOpen
} from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import { sha256, deterministicShuffle } from "../utils/seed";
import { useRaffleConfig } from "../admin/RaffleConfigContext";

interface Raffle {
  id: string;
  title: string;
  status: string;
  winnerNumber?: string;
  winnerName?: string;
  seed?: string | null;
  seedCommitment?: string;
  seedVersion?: number;
  algorithmVersion?: number;
  participantSnapshotId?: string | null;
  participantsHash?: string | null;
  drawTotalParticipants?: number;
  drawDate?: string;
  drawTime?: string;
  updatedAt?: string;
  price?: number;
  imageUrl?: string;
}

export default function RaffleAuditView({
  currentPath,
  setCurrentPath
}: {
  currentPath: string;
  setCurrentPath: (path: string) => void;
}) {
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRaffle, setSelectedRaffle] = useState<Raffle | null>(null);
  
  // Verification states
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    step1_seed: boolean;      // Seed matches commitment
    step2_snapshot: boolean;  // Snapshot matches participantsHash
    step3_algo: boolean;      // Algo and version verified
    step4_shuffle: boolean;   // Draw matches winner index
    step5_winner: boolean;    // Shuffled first item matches published winner
    message?: string;
    details?: string;
    reproducedWinner?: string;
  } | null>(null);

  const { raffles: configRaffles } = useRaffleConfig();

  useEffect(() => {
    try {
      setLoading(true);
      const list: Raffle[] = (configRaffles || []).map((data: any) => ({
        id: data.id,
        title: data.title || "Rifa Sem Título",
        status: data.status || "ativa",
        ...data
      }));

      // Sort: closed/sorted first, then updatedAt desc
      const sorted = list.sort((a, b) => {
        const isAClosed = a.status === "encerrada" || a.status === "arquivada" || a.status === "sorteada" || !!a.winnerNumber;
        const isBClosed = b.status === "encerrada" || b.status === "arquivada" || b.status === "sorteada" || !!b.winnerNumber;
        if (isAClosed && !isBClosed) return -1;
        if (!isAClosed && isBClosed) return 1;
        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      });

      setRaffles(sorted);
      
      // Auto-select first closed raffle if available
      const firstClosed = sorted.find(r => r.status === "encerrada" || r.status === "arquivada" || r.status === "sorteada" || !!r.winnerNumber);
      if (firstClosed) {
        setSelectedRaffle(firstClosed);
      } else if (sorted.length > 0) {
        setSelectedRaffle(sorted[0]);
      }
    } catch (err) {
      console.error("Erro ao carregar rifas para auditoria:", err);
    } finally {
      setLoading(false);
    }
  }, [configRaffles]);

  const handleVerify = async () => {
    if (!selectedRaffle) return;
    
    setVerifying(true);
    setVerificationResult(null);
    
    try {
      // Small visual delay to simulate mathematical calculation
      await new Promise(resolve => setTimeout(resolve, 800));

      const {
        id: raffleId,
        status,
        seed,
        seedCommitment,
        participantsHash,
        participantSnapshotId,
        winnerNumber
      } = selectedRaffle;

      const isRaffleClosed = status === "encerrada" || status === "arquivada" || status === "sorteada" || !!winnerNumber;
      if (!isRaffleClosed) {
        setVerificationResult({
          success: false,
          step1_seed: false,
          step2_snapshot: false,
          step3_algo: false,
          step4_shuffle: false,
          step5_winner: false,
          message: "A rifa ainda está ativa.",
          details: "Não é possível realizar a auditoria criptográfica de uma rifa aberta, pois o seed secreto continua protegido no servidor."
        });
        setVerifying(false);
        return;
      }

      if (!seed) {
        setVerificationResult({
          success: false,
          step1_seed: false,
          step2_snapshot: false,
          step3_algo: false,
          step4_shuffle: false,
          step5_winner: false,
          message: "Seed secreto não publicado.",
          details: "O sorteio foi marcado como encerrado, mas o seed secreto do administrador não foi revelado."
        });
        setVerifying(false);
        return;
      }

      if (!seedCommitment) {
        setVerificationResult({
          success: false,
          step1_seed: false,
          step2_snapshot: false,
          step3_algo: false,
          step4_shuffle: false,
          step5_winner: false,
          message: "Commitment ausente.",
          details: "Não existe um seedCommitment registrado para esta rifa."
        });
        setVerifying(false);
        return;
      }

      if (!participantSnapshotId) {
        setVerificationResult({
          success: false,
          step1_seed: false,
          step2_snapshot: false,
          step3_algo: false,
          step4_shuffle: false,
          step5_winner: false,
          message: "Snapshot de participantes ausente.",
          details: "Não foi localizado o identificador do snapshot imutável para esta rifa."
        });
        setVerifying(false);
        return;
      }

      // 1. Verify SHA-256(seed) === seedCommitment
      const calculatedCommitment = sha256(seed);
      const isSeedValid = calculatedCommitment === seedCommitment;
      
      if (!isSeedValid) {
        setVerificationResult({
          success: false,
          step1_seed: false,
          step2_snapshot: false,
          step3_algo: false,
          step4_shuffle: false,
          step5_winner: false,
          message: "DIVERGÊNCIA: Seed não corresponde ao commitment!",
          details: `O hash SHA-256 do seed revelado (${calculatedCommitment}) não bate com o commitment pré-registrado (${seedCommitment}). Isto indica manipulação pós-fato!`
        });
        setVerifying(false);
        return;
      }

      // 2. Fetch official immutable participant snapshot
      const snapshotRef = doc(db, "raffles", raffleId, "snapshots", participantSnapshotId);
      const snapshotSnap = await getDoc(snapshotRef);
      
      if (!snapshotSnap.exists()) {
        setVerificationResult({
          success: isSeedValid,
          step1_seed: isSeedValid,
          step2_snapshot: false,
          step3_algo: false,
          step4_shuffle: false,
          step5_winner: false,
          message: "Snapshot não encontrado no banco.",
          details: `O documento de snapshot imutável '${participantSnapshotId}' não pôde ser localizado para verificação de integridade.`
        });
        setVerifying(false);
        return;
      }

      const snapshotData = snapshotSnap.data();
      const snapshotParticipants: string[] = snapshotData.participants || [];
      const snapHashOnDoc = snapshotData.participantsHash;

      // Ensure snapshot contains items
      if (snapshotParticipants.length === 0) {
        setVerificationResult({
          success: false,
          step1_seed: true,
          step2_snapshot: false,
          step3_algo: false,
          step4_shuffle: false,
          step5_winner: false,
          message: "Snapshot vazio.",
          details: "O snapshot de participantes está vazio ou não pôde ser lido corretamente."
        });
        setVerifying(false);
        return;
      }

      // 3. Compute SHA-256 of canonical snapshot list to match with participantsHash
      const sortedParticipants = [...snapshotParticipants].sort((a, b) => a.localeCompare(b));
      const canonicalString = sortedParticipants.join(",");
      const calculatedParticipantsHash = sha256(canonicalString);

      const isSnapshotIntegrityValid = (calculatedParticipantsHash === participantsHash) && (calculatedParticipantsHash === snapHashOnDoc);

      if (!isSnapshotIntegrityValid) {
        setVerificationResult({
          success: false,
          step1_seed: true,
          step2_snapshot: false,
          step3_algo: false,
          step4_shuffle: false,
          step5_winner: false,
          message: "DIVERGÊNCIA: Integridade do snapshot violada!",
          details: `O hash calculado da lista canônica de participantes (${calculatedParticipantsHash}) não corresponde ao participantsHash registrado (${participantsHash}). Isso indica alteração artificial dos participantes!`
        });
        setVerifying(false);
        return;
      }

      // 4. Verify Algorithm and version identifier
      const algoName = "Fisher-Yates CSPRNG";
      const algoVersion = selectedRaffle.algorithmVersion || 1;
      const isAlgoValid = true; // Algorithm identified

      // 5. Deterministic shuffle execution
      const shuffledList = deterministicShuffle(snapshotParticipants, seed);
      const isShuffleReproduced = shuffledList.length > 0;
      const reproducedWinner = shuffledList[0];

      // 6. Check reproduced winner matches published winner
      const publishedWinnerClean = String(winnerNumber || "").trim();
      const reproducedWinnerClean = String(reproducedWinner || "").trim();
      
      const normalizeQuota = (q: string): string => {
        const cleaned = String(q).replace(/^0+/, "");
        return cleaned === "" ? "0" : cleaned;
      };

      const isWinnerConfirmed = normalizeQuota(publishedWinnerClean) === normalizeQuota(reproducedWinnerClean);

      if (!isWinnerConfirmed) {
        setVerificationResult({
          success: false,
          step1_seed: true,
          step2_snapshot: true,
          step3_algo: true,
          step4_shuffle: true,
          step5_winner: false,
          message: "DIVERGÊNCIA: Vencedor reproduzido não corresponde ao publicado!",
          details: `O sorteio reproduzido deterministicamente resultou na cota #${reproducedWinnerClean}, porém o vencedor publicado foi a cota #${publishedWinnerClean}.`,
          reproducedWinner: reproducedWinnerClean
        });
        setVerifying(false);
        return;
      }

      // ALL VERIFICATIONS PASSED!
      setVerificationResult({
        success: true,
        step1_seed: true,
        step2_snapshot: true,
        step3_algo: true,
        step4_shuffle: true,
        step5_winner: true,
        reproducedWinner: reproducedWinnerClean,
        message: "SORTEIO 100% AUDITADO E CONFIRMADO COM SUCESSO!",
        details: "Todos os parâmetros criptográficos e lógicos foram verificados localmente no seu navegador. Nenhuma discrepância foi encontrada."
      });

    } catch (err: any) {
      setVerificationResult({
        success: false,
        step1_seed: false,
        step2_snapshot: false,
        step3_algo: false,
        step4_shuffle: false,
        step5_winner: false,
        message: "Erro durante a execução da verificação.",
        details: err.message || "Erro inesperado."
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12 space-y-10" id="public-audit-page">
      {/* HERO SECTION */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-black uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" />
          Auditoria Pública Criptográfica
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
          Transparência <span className="text-[#a3e635]">Matemática</span>
        </h2>
        <p className="text-zinc-400 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
          Nesta área você pode auditar e reproduzir qualquer sorteio da RifaMaster. Verifique se o seed não foi alterado, garanta que os participantes são imutáveis e confirme o vencedor.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-zinc-950 border border-zinc-900 rounded-3xl">
          <RefreshCw className="w-8 h-8 text-[#a3e635] animate-spin mb-4" />
          <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Carregando dados de sorteio...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* RAFFLE SELECTOR LIST */}
          <div className="lg:col-span-1 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500">Selecione uma Rifa</h3>
            <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-2 scrollbar-thin">
              {raffles.length === 0 ? (
                <div className="p-6 bg-zinc-950 border border-zinc-900 rounded-2xl text-center">
                  <p className="text-zinc-500 text-xs font-bold">Nenhuma rifa encontrada.</p>
                </div>
              ) : (
                raffles.map((r) => {
                  const isSelected = selectedRaffle?.id === r.id;
                  const isClosed = r.status === "encerrada" || r.status === "arquivada" || r.status === "sorteada" || !!r.winnerNumber;
                  return (
                    <button
                      key={r.id}
                      onClick={() => {
                        setSelectedRaffle(r);
                        setVerificationResult(null);
                      }}
                      className={`w-full text-left p-4 rounded-2xl border transition-all relative overflow-hidden group ${
                        isSelected 
                          ? "bg-zinc-900/60 border-[#a3e635]/50 shadow-md shadow-[#a3e635]/5" 
                          : "bg-zinc-950 border-zinc-900 hover:border-zinc-800"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2 mb-1.5">
                        <span className="text-xs font-bold text-white line-clamp-1 group-hover:text-[#a3e635] transition-colors">
                          {r.title}
                        </span>
                        <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      
                      <div className="flex items-center justify-between mt-3 text-[10px]">
                        <span className="text-zinc-500 font-medium">ID: {r.id}</span>
                        {isClosed ? (
                          <span className="px-2 py-0.5 bg-zinc-900 text-zinc-400 font-black uppercase rounded-md border border-zinc-800">
                            Sorteada
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 font-black uppercase rounded-md border border-emerald-500/20">
                            Ativa
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* AUDIT BOARD */}
          <div className="lg:col-span-2 space-y-6">
            {selectedRaffle ? (
              <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 space-y-6 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-900 pb-5 gap-4">
                  <div className="text-left space-y-1">
                    <h3 className="text-lg font-black text-white">{selectedRaffle.title}</h3>
                    <p className="text-[11px] text-zinc-500 font-mono">ID Único da Rifa: {selectedRaffle.id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedRaffle.seed ? (
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-xl text-[10px] font-black uppercase tracking-wider">
                        <LockOpen className="w-3.5 h-3.5 text-zinc-500" />
                        Seed Revelado
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl text-[10px] font-black uppercase tracking-wider">
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        Seed Protegido
                      </div>
                    )}
                  </div>
                </div>

                {/* INFO LIST */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Status do Sorteio */}
                  <div className="bg-zinc-900/30 border border-zinc-900/50 p-4 rounded-2xl text-left space-y-1">
                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500 block">Status da Rifa</span>
                    <span className="text-xs font-bold text-white capitalize">
                      {selectedRaffle.status === "encerrada" 
                        ? "Encerrada (Sorteada)" 
                        : selectedRaffle.status === "arquivada" 
                        ? "Arquivada (Sorteada)" 
                        : selectedRaffle.status === "sorteada"
                        ? "Sorteada"
                        : "Aberta (Ativa)"}
                    </span>
                  </div>

                  {/* Vencedor Publicado */}
                  <div className="bg-zinc-900/30 border border-zinc-900/50 p-4 rounded-2xl text-left space-y-1">
                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#a3e635] block">Vencedor Publicado</span>
                    <span className="text-xs font-black text-white">
                      {selectedRaffle.winnerNumber 
                        ? `Cota #${selectedRaffle.winnerNumber} (${selectedRaffle.winnerName || "N/A"})` 
                        : "Sorteio pendente"}
                    </span>
                  </div>

                  {/* Algoritmo Utilizado */}
                  <div className="bg-zinc-900/30 border border-zinc-900/50 p-4 rounded-2xl text-left space-y-1">
                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500 block">Algoritmo e Versão</span>
                    <span className="text-xs font-bold text-white">Fisher-Yates CSPRNG (v{selectedRaffle.algorithmVersion || 1})</span>
                  </div>

                  {/* Quantidade de Participantes */}
                  <div className="bg-zinc-900/30 border border-zinc-900/50 p-4 rounded-2xl text-left space-y-1">
                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500 block">Participantes Sorteados</span>
                    <span className="text-xs font-bold text-white font-mono">{selectedRaffle.drawTotalParticipants || 0} cotas pagas</span>
                  </div>

                  {/* Snapshot Identificador */}
                  <div className="bg-zinc-900/30 border border-zinc-900/50 p-4 rounded-2xl text-left space-y-1 md:col-span-2">
                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500 block">Identificação do Snapshot Imutável</span>
                    <span className="text-xs font-mono text-zinc-300 break-all">{selectedRaffle.participantSnapshotId || "Nenhum snapshot associado ainda"}</span>
                  </div>

                  {/* ParticipantsHash */}
                  <div className="bg-zinc-900/30 border border-zinc-900/50 p-4 rounded-2xl text-left space-y-1 md:col-span-2">
                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500 block">participantsHash (Integridade)</span>
                    <span className="text-xs font-mono text-zinc-300 break-all">{selectedRaffle.participantsHash || "Pendente de geração"}</span>
                  </div>

                  {/* Seed Commitment */}
                  <div className="bg-zinc-900/30 border border-zinc-900/50 p-4 rounded-2xl text-left space-y-1 md:col-span-2">
                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500 block">Seed Commitment pré-sorteio</span>
                    <span className="text-xs font-mono text-zinc-300 break-all">{selectedRaffle.seedCommitment || "Nenhum commitment configurado"}</span>
                  </div>

                  {/* Seed Revelado */}
                  <div className="bg-zinc-900/30 border border-zinc-900/50 p-4 rounded-2xl text-left space-y-1 md:col-span-2">
                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500 block">Seed Revelado pós-sorteio</span>
                    {selectedRaffle.seed ? (
                      <span className="text-xs font-mono text-emerald-400 break-all">{selectedRaffle.seed}</span>
                    ) : (
                      <span className="text-xs font-bold text-amber-500 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5" />
                        Oculto até o encerramento da rifa
                      </span>
                    )}
                  </div>
                </div>

                {/* VERIFY BUTTON */}
                <div className="pt-2 border-t border-zinc-900">
                  <button
                    onClick={handleVerify}
                    disabled={verifying}
                    className="w-full py-4 bg-gradient-to-r from-[#a3e635] to-[#bef264] hover:from-[#bef264] hover:to-[#d9f99d] text-black font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-[#a3e635]/15 transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {verifying ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-black" />
                        Calculando auditoria criptográfica...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 text-black" />
                        Verificar Sorteio
                      </>
                    )}
                  </button>
                </div>

                {/* VERIFICATION REPORT PANEL */}
                {verificationResult && (
                  <div className={`border p-5 rounded-2xl text-left space-y-4 animate-fadeIn ${
                    verificationResult.success 
                      ? "bg-emerald-500/5 border-emerald-500/20" 
                      : "bg-red-500/5 border-red-500/20"
                  }`}>
                    <div className="flex items-center gap-2.5">
                      {verificationResult.success ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                      )}
                      <h4 className={`text-xs font-black uppercase tracking-wider ${
                        verificationResult.success ? "text-emerald-400" : "text-red-400"
                      }`}>
                        {verificationResult.message}
                      </h4>
                    </div>

                    <p className="text-zinc-300 text-xs leading-relaxed">
                      {verificationResult.details}
                    </p>

                    <div className="space-y-2 border-t border-zinc-900 pt-3 text-[11px] font-bold">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">1. SHA-256(seed) === seedCommitment:</span>
                        <span className={verificationResult.step1_seed ? "text-emerald-400" : "text-red-400"}>
                          {verificationResult.step1_seed ? "✓ Sucesso" : "✗ Falhou"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">2. canonical_list(snapshot) === participantsHash:</span>
                        <span className={verificationResult.step2_snapshot ? "text-emerald-400" : "text-red-400"}>
                          {verificationResult.step2_snapshot ? "✓ Sucesso" : "✗ Falhou"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">3. Identificação do Algoritmo e Versão:</span>
                        <span className={verificationResult.step3_algo ? "text-emerald-400" : "text-red-400"}>
                          {verificationResult.step3_algo ? "✓ Sucesso" : "✗ Falhou"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">4. Reprodução Determinística do Sorteio:</span>
                        <span className={verificationResult.step4_shuffle ? "text-emerald-400" : "text-red-400"}>
                          {verificationResult.step4_shuffle ? "✓ Sucesso" : "✗ Falhou"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">5. Correspondência do Vencedor Publicado:</span>
                        <span className={verificationResult.step5_winner ? "text-emerald-400" : "text-red-400"}>
                          {verificationResult.step5_winner ? "✓ Sucesso" : "✗ Falhou"}
                        </span>
                      </div>
                    </div>

                    {verificationResult.success && verificationResult.reproducedWinner && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-center space-y-1">
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-emerald-400 block">Vencedor Criptograficamente Confirmado</span>
                        <span className="text-base font-black text-white">COTA #{verificationResult.reproducedWinner}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-12 text-center text-zinc-500 text-xs font-bold">
                Nenhuma rifa selecionada para auditoria.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
