import { PropsWithChildren, memo, useState, useSyncExternalStore } from "react";
import { FaCopy } from "react-icons/fa6";
import { GoFileSymlinkFile } from "react-icons/go";
import Markdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { prism, vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import styled, { keyframes } from "styled-components";
import { ChatMessage } from "../types/Message";
import { localMemState } from './utilities/localMemState';
import { vscode } from "./utilities/vscode";

const Entry = styled.li`
	border-bottom: 1px solid rgba(200, 200, 200, 0.5);
	padding: 0px 4px;
`;

const Code = styled.code`
	white-space: pre-wrap;
`;

const LoaderAnimation = keyframes`
  	0% {
        transform: rotate(0deg);
	}
	100% {
		transform: rotate(360deg);
	}
`;

const LabelContainer = styled.span`
	display: flex;
	align-items: center;
`;

const Loader = styled.span`
	width: 16px;
	height: 16px;
	border: 2px solid #eee;
	border-bottom-color: transparent;
	border-radius: 50%;
	display: inline-block;
	box-sizing: border-box;
	animation: ${LoaderAnimation} 1s linear infinite;
	margin-left: 8px;
`;

const MarkdownBox = styled.div`
	overflow-x: scroll;
	background-color: var(--vscode-editor-background);

	& > code {
		background: var(--vscode-editor-background);
	}
`;

const MarkdownOperationsBox = styled.div`
	display: flex;
	justify-content: flex-end;
	position: relative;
	top: -20px;
	right: 6px;
	padding-right: 10px;
	position: absolute;
`;

const MarkdownOperationsBoxHighlight = styled.ul`
	border: 1px solid rgb(65, 65, 65);
	padding: 2px;
	display: flex;
	gap: 6px;
	list-style: none;

	& > li {
		padding: 2px;

		&:hover {
			background-color: rgba(200, 200, 200, 0.1);
		}

		& > svg {
			cursor: pointer;
		}
	}
`;

type MarkDownObject = {
	props: {
		children: [boolean, MarkDownEntry[] | string];
	};
};

type MarkDownEntry = {
	props: {
		children: string[];
	};
};

const CodeContainer = memo(({ children }: PropsWithChildren) => {
	const [toolboxVisible, setToolboxVisible] = useState(false);

	//Sort of hacky, but it works.
	const getMarkdownFromChildren = () => {
		const markDown = children as MarkDownObject;

		return (markDown.props.children[1] as MarkDownEntry[]).reduce(
			(acc: string, curr: string | MarkDownEntry) => {
				if (typeof curr === "string") {
					acc += curr;
				} else if (curr.props) {
					acc += curr.props.children[0];
				}

				return acc;
			},
			""
		);
	};

	const sendToNewFile = () => {
		vscode.postMessage({
			command: "copyToFile",
			value: getMarkdownFromChildren(),
		});
	};

	const copyToClipboard = () => {
		vscode.postMessage({
			command: "clipboard",
			value: getMarkdownFromChildren(),
		});
	};

	return (
		<div
			style={{ position: "relative", top: "16px", paddingBottom: "12px" }}
			onMouseEnter={() => setToolboxVisible(true)}
			onMouseLeave={() => setToolboxVisible(false)}
		>
			{toolboxVisible && (
				<MarkdownOperationsBox>
					<div style={{ flex: "1 0 auto" }}></div>
					<MarkdownOperationsBoxHighlight>
						<li
							role="presentation"
							title="Copy code to clipboard"
							onClick={copyToClipboard}
						>
							<FaCopy size={16} />
						</li>
						<li
							role="presentation"
							title="Send to new file"
							onClick={sendToNewFile}
						>
							<GoFileSymlinkFile size={16} />
						</li>
					</MarkdownOperationsBoxHighlight>
				</MarkdownOperationsBox>
			)}
			<MarkdownBox>{children}</MarkdownBox>
		</div>
	);
});

const ChatEntry = ({
	from,
	message,
	loading,
	context,
}: PropsWithChildren<ChatMessage>) => {
	const getContextDisplay = (): string => {
		if (!context) {
			return "";
		}
		const { workspaceName, lineRange, fileName } = context;

		if (workspaceName) {
			try {
				const [, relativeDir] = fileName.split(workspaceName);

				const path = relativeDir.substring(
					0,
					relativeDir.lastIndexOf("/")
				);
				const file = relativeDir.substring(
					relativeDir.lastIndexOf("/") + 1,
					relativeDir.length
				);
				return `${file} ${path} ${lineRange}`;
			} catch (error) {
				console.log(error);
			}
		}

		return "";
	};

	const showSelectedContext = () => {
		if (!context) {
			return;
		}

		vscode.postMessage({
			command: "showContext",
			value: context,
		});
	};

	const lm = useSyncExternalStore(localMemState.subscribe, localMemState.getSnapshot);
	const theme = lm['theme'] as number;
	const codeTheme = (theme === 1 || theme === 4) ? prism : vscDarkPlus;

	return (
		<Entry>
			<LabelContainer>
				<h3>{from === "User" ? "Me" : "Wingman"}</h3>
				{loading && <Loader />}
			</LabelContainer>
			<div>
				{context && (
					<>
						<div
							className="icon"
							onClick={showSelectedContext}
							style={{
								display: "flex",
								alignItems: "center",
								gap: "4px",
								padding: "4px",
								border: "1px solid",
							}}
						>
							<i className="codicon codicon-file"></i>
							<span>{getContextDisplay()}</span>
						</div>
					</>
				)}
			</div>
			<Markdown
				children={message}
				components={{
					code(props) {
						const { children, className, node, ...rest } = props;

						const languageType = /language-(\w+)/.exec(
							className || ""
						);

						return languageType ? (
							<SyntaxHighlighter
								PreTag={CodeContainer}
								children={String(children).replace(/\n$/, "")}
								style={codeTheme}
								language={languageType[1]}
							/>
						) : (
							<Code {...rest} className={className}>
								{children}
							</Code>
						);
					},
				}}
			/>
		</Entry>
	);
};

export default ChatEntry;
