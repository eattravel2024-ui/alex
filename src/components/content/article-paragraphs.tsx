import { Fragment } from "react";
import {
  parseArticleParagraphs,
  type InlineNode,
} from "@/lib/article-formatting";

function InlineContent({ nodes }: { nodes: InlineNode[] }) {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "text":
        return <Fragment key={index}>{node.text}</Fragment>;
      case "strong":
        return (
          <strong key={index}>
            <InlineContent nodes={node.children} />
          </strong>
        );
      case "em":
        return (
          <em key={index}>
            <InlineContent nodes={node.children} />
          </em>
        );
      case "link":
        return (
          <a
            key={index}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            <InlineContent nodes={node.children} />
          </a>
        );
    }
  });
}

export function ArticleParagraphs({ paragraphs }: { paragraphs: string[] }) {
  return parseArticleParagraphs(paragraphs).map((block, index) => {
    if (block.type === "paragraph") {
      return (
        <p key={index} className="article-body-paragraph">
          <InlineContent nodes={block.children} />
        </p>
      );
    }
    const items = block.items.map((item, itemIndex) => (
      <li key={itemIndex}>
        <InlineContent nodes={item} />
      </li>
    ));
    return block.type === "ordered-list" ? (
      <ol key={index} className="article-body-list" start={block.start}>
        {items}
      </ol>
    ) : (
      <ul key={index} className="article-body-list">
        {items}
      </ul>
    );
  });
}
