import { vscode } from "../../utilities/vscode";
import { useEffect } from "react";
import { Loader } from "../../Loader";
import { IndexerSettings } from "@shared/types/Indexer";
import { useSettingsContext } from "../../context/settingsContext";
import { FiTrash2 } from 'react-icons/fi';

type IndexStats = {
	exists: boolean;
	processing: boolean;
	files: string[];
};

let interval: NodeJS.Timeout;

export default function Indexer() {
	const { indexFilter, exclusionFilter, setIndexFilter, totalFileCount, indexStats, setIndex } =
		useSettingsContext();

	useEffect(() => {
		vscode.postMessage({
			command: "check-index",
		});
		interval = setInterval(() => {
			vscode.postMessage({
				command: "check-index",
			});
		}, 3000);

		return () => {
			clearInterval(interval);
		};
	}, []);

	const buildIndex = () => {
		vscode.postMessage({
			command: "build-index",
			value: {
				indexFilter,
				exclusionFilter,
			} satisfies IndexerSettings,
		});
		setIndex((idx) => ({ ...idx, processing: true }));
	};

	const deleteIndex = () => {
		vscode.postMessage({
			command: "delete-index",
		});
	};

	const deleteFileFromIndex = (filePath: string) => {
		vscode.postMessage({
			command: 'delete-indexed-file',
			value: filePath
		})
	}

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<div className="flex-1 overflow-y-auto">
				<div className="flex flex-col gap-8 p-4">
					<div className="space-y-4">
						<p className="text-lg font-bold">
							Status:{" "}
							{indexStats.exists
								? indexStats.processing
									? "Processing"
									: "Ready"
								: "Not Found"}
						</p>
						<p className="text-md">
							The indexer will breakdown your codebase to use as context
							in chat, or interactively with the code composer. It will
							scan your workspace for any files meeting the filter
							criteria below. By default, Wingman will include your
							'.gitignore' file in your exclusion filter.
						</p>
						<p className="text-md">
							The indexer can be explicitly disabled in Wingman settings.
							When enabled (default), files will be re-indexed on save, if
							their contents have changed.
						</p>
						<section className="flex flex-col gap-4">
							<label>Inclusion Filter:</label>
							<input
								type="text"
								className="w-full p-2 border bg-[var(--vscode-input-background)] border-[var(--vscode-editor-foreground)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								value={indexFilter || ""}
								onChange={(e) => setIndexFilter(e.target.value)}
							/>
							<div className="text-sm text-[var(--vscode-descriptionForeground)]">
								<p>Example patterns:</p>
								<ul className="list-disc pl-5 space-y-1">
									<li>**/*.{'{ts,tsx,js,jsx}'} - All TypeScript and JavaScript files</li>
									<li>src/**/*.ts - All TypeScript files in src directory</li>
									<li>**/*.{'{py,go}'} - All Python and Go files</li>
									<li>{'{src,lib}/**/*.ts'} - TypeScript files in src or lib directories</li>
								</ul>
							</div>
							{!indexStats.processing && (
								<button
									className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
									disabled={indexStats.processing || !indexFilter}
									onClick={() => buildIndex()}
								>
									Full Build Index
								</button>
							)}
						</section>
						{indexStats.processing && (
							<p className="flex items-center">
								<Loader /> <span className="ml-2">Building Index...</span>
							</p>
						)}
						{indexStats.exists && !indexStats.processing && (
							<button
								className="bg-red-600 text-white px-4 py-2 rounded"
								onClick={() => deleteIndex()}
							>
								Delete Index
							</button>
						)}
					</div>
					{!indexStats.processing && (
						<div className="flex flex-col gap-4">
							<div className="bg-[var(--vscode-list-hoverBackground)] rounded-lg p-4 shadow-sm">
								<div className="flex items-center justify-between">
									<h3 className="text-lg font-bold">Indexed Files</h3>
									<span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
										{indexStats.files.length} / {totalFileCount}
									</span>
								</div>
								<div className="w-full bg-stone-400 rounded-full h-2.5 mt-3">
									<div
										className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
										style={{ width: `${(indexStats.files.length / (totalFileCount === 0 ? 1 : totalFileCount)) * 100}%` }}
									/>
								</div>
							</div>
							<details className="group">
								<summary className="cursor-pointer list-none">
									<div className="flex items-center gap-2 text-sm text-[var(--vscode-input-foreground)]">
										<svg
											className="w-4 h-4 transition-transform group-open:rotate-90"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
										</svg>
										View all files
									</div>
								</summary>

								<div className="mt-2 pl-6">
									<ul className="space-y-1 max-h-[400px] overflow-y-auto pr-2">
										{indexStats.files && indexStats.files.map((file, idx) => (
											<li
												key={idx}
												className="text-sm text-[var(--vscode-input-foreground)] hover:bg-[var(--vscode-list-hoverBackground)] rounded flex items-center justify-between group px-2 py-1"
											>
												<span className="truncate">{file}</span>
												<button
													className="p-1 rounded hover:bg-stone-400"
													onClick={(e) => {
														e.stopPropagation();
														deleteFileFromIndex(file);
													}}
													title="Remove file from index"
												>
													<FiTrash2
														className="w-4 h-4 text-red-600"
													/>
												</button>
											</li>
										))}
									</ul>
								</div>
							</details>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
