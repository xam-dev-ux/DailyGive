import Link from "next/link";
import { formatUnits } from "viem";
import { publicClient, getContractEventsChunked } from "@/lib/viem";
import { dailyGiveAbi, b20Abi } from "@/lib/abi";
import { DAILYGIVE_ADDRESS, DEPLOY_BLOCK, GIVEN_ADDRESS, GIVE_DECIMALS } from "@/lib/contracts";

export default async function ReputationPage({ params }: { params: Promise<{ fid: string }> }) {
  const { fid: fidParam } = await params;
  const fid = BigInt(fidParam);

  const wallet = await publicClient.readContract({
    address: DAILYGIVE_ADDRESS,
    abi: dailyGiveAbi,
    functionName: "wallet",
    args: [fid],
  });

  const [balance, receivedLogs, givenLogs] = await Promise.all([
    publicClient.readContract({
      address: GIVEN_ADDRESS,
      abi: b20Abi,
      functionName: "balanceOf",
      args: [wallet],
    }),
    getContractEventsChunked({
      address: DAILYGIVE_ADDRESS,
      abi: dailyGiveAbi,
      eventName: "Tipped",
      args: { toFid: fid },
      fromBlock: DEPLOY_BLOCK,
      toBlock: "latest",
    }),
    getContractEventsChunked({
      address: DAILYGIVE_ADDRESS,
      abi: dailyGiveAbi,
      eventName: "Tipped",
      args: { fromFid: fid },
      fromBlock: DEPLOY_BLOCK,
      toBlock: "latest",
    }),
  ]);

  const totalReceived = receivedLogs.reduce((sum, log) => sum + (log.args.amount ?? 0n), 0n);
  const totalGiven = givenLogs.reduce((sum, log) => sum + (log.args.amount ?? 0n), 0n);
  const generosityIndex = totalReceived > 0n ? Number(totalGiven) / Number(totalReceived) : totalGiven > 0n ? Infinity : 0;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4 text-white">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">fid {fidParam}</h1>
        <Link href="/" className="text-sm text-white/60 hover:text-white">
          Back
        </Link>
      </header>

      <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-6 text-center">
        <p className="text-xs uppercase tracking-wide text-white/40">GIVEN reputation</p>
        <p className="mt-1 text-3xl font-semibold text-amber-300">{formatUnits(balance, GIVE_DECIMALS)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/40">Tips given</p>
          <p className="mt-1 text-lg font-medium">{formatUnits(totalGiven, GIVE_DECIMALS)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/40">Generosity index</p>
          <p className="mt-1 text-lg font-medium">
            {generosityIndex === Infinity ? "∞" : generosityIndex.toFixed(2)}
          </p>
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-xs uppercase tracking-wide text-white/40">Tips received</h2>
        {receivedLogs.length === 0 ? (
          <p className="text-sm text-white/40">None yet.</p>
        ) : (
          <ul className="space-y-2">
            {receivedLogs
              .slice(-10)
              .reverse()
              .map((log) => (
                <li
                  key={log.transactionHash}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                >
                  <span>from fid {log.args.fromFid?.toString()}</span>
                  <span className="font-medium text-amber-300">
                    {formatUnits(log.args.amount ?? 0n, GIVE_DECIMALS)} GIVE
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
