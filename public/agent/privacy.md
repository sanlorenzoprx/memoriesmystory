# Memories: My Story — Public Agent Privacy Boundary

The ASC-01 agent surface is an acquisition and guidance surface. It is not an authenticated family-archive interface.

## Public tools may use

- product information;
- the Living Memory concept;
- caller-supplied relationship/theme/occasion labels;
- deterministic storytelling prompts;
- interview-plan guidance;
- general photo-story context supplied as text;
- a human start URL.

## Public tools may never retrieve

- photographs or image assets;
- original voice recordings or audio derivatives;
- transcripts;
- private Memory Stories;
- family members or relationship graph;
- identity or ownership records;
- provenance records;
- private share tokens;
- archive search results.

The Worker routes public ASC requests before, and separately from, authenticated archive/media routing. ASC code does not call those handlers.

## Telemetry

ASC event logging contains only coarse operational fields: product, channel, tool name, generated starter ID, agent client when supplied, protocol, and success. It does not log the request body or family-story content.

## Human action

A start URL opens the ordinary Memories: My Story application. An agent call cannot create a Memory Story, bind an identity, upload a photograph, record a voice, share a story, or change archive visibility.
