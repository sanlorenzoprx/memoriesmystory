import { useState } from "react";
import { Link } from "react-router";

import { livingMemoryOffers, type OfferId } from "../commerce/offers";

const proofLinks = {
  pictures: "https://pubmed.ncbi.nlm.nih.gov/10504900/",
  voice: "https://pubmed.ncbi.nlm.nih.gov/21988380/",
  together: "https://pubmed.ncbi.nlm.nih.gov/30194752/"
};

export function LandingExperience() {
  const [demoPlaying, setDemoPlaying] = useState(false);

  return (
    <main className="landing-page" id="main-content">
      <section className="lm-section lm-hero" aria-labelledby="landing-title">
        <div className="lm-section-inner lm-hero-grid">
          <div className="lm-copy-column">
            <p className="lm-eyebrow">The story behind the photograph matters.</p>
            <h1 id="landing-title">Your voice turns a photograph into a Living Memory.</h1>
            <p className="lm-hero-support">
              A photograph shows the moment. Your voice tells the story behind it.
            </p>
            <p className="lm-body-copy">
              A family photograph can last for generations while the story behind it fades much sooner. MemoriesMyStory keeps the photo together with the real voice, people, places, and details that give the moment meaning.
            </p>
            <div className="lm-action-row">
              <FreeMemoryLink placement="hero">Create Your First Living Memory</FreeMemoryLink>
              <a className="lm-secondary-button" href="#living-memory-demo">See a Living Memory</a>
            </div>
            <p className="lm-trust-line">Your first complete Living Memory is free. No credit card required.</p>
          </div>
          <StoryPhoto variant="sisters" caption="One photograph can hold a lifetime of stories." />
        </div>
      </section>

      <section className="lm-section lm-section-dark" id="living-memory-demo" aria-labelledby="demo-title">
        <div className="lm-section-inner lm-demo-grid">
          <StoryPhoto variant="family" caption={demoPlaying ? "Living Memory" : "The photograph"} dark />
          <div className="lm-copy-column lm-copy-light">
            <p className="lm-eyebrow">Experience the Magic Moment</p>
            <h2 id="demo-title">Hear the story behind the photo.</h2>
            <p className="lm-body-copy">
              The photograph shows what happened. The voice tells you what it meant.
            </p>
            <button
              className="lm-audio-button"
              type="button"
              aria-pressed={demoPlaying}
              onClick={() => setDemoPlaying((current) => !current)}
            >
              <span className="lm-play-icon" aria-hidden="true">{demoPlaying ? "Ⅱ" : "▶"}</span>
              <span>{demoPlaying ? "Pause sample preview" : "Hear the story"}</span>
            </button>
            <div className={`lm-demo-reveal ${demoPlaying ? "is-visible" : ""}`} aria-live="polite">
              <VoiceWave />
              <blockquote>
                “That summer in San Juan was the first time the whole family stayed under one roof.”
              </blockquote>
              <div className="lm-context-chips" aria-label="Story details">
                <span>San Juan</span>
                <span>Summer 1972</span>
                <span>Family visit</span>
              </div>
              <p className="lm-sample-note">Sample product preview. Real Living Memories preserve the person's actual recording.</p>
            </div>
          </div>
        </div>
      </section>

      <FreeInvitation
        eyebrow="Try the idea yourself"
        title="Try it with one photograph."
        body="Choose a photograph that means something to you. Tell the story in your own voice. MemoriesMyStory helps keep the photo, voice, and important details together."
        placement="post_demo_free_offer"
        button="Create One Living Memory Free"
        note="One photograph. Up to 10 minutes of voice at the current offer target. No credit card required."
      />

      <section className="lm-section" aria-labelledby="problem-title">
        <div className="lm-section-inner lm-split">
          <div className="lm-copy-column">
            <p className="lm-eyebrow">The problem</p>
            <h2 id="problem-title">Every family has photographs whose stories live in only one or two people's memories.</h2>
            <p className="lm-body-copy">
              The picture may still be there years from now. But will anyone remember who is in it, where it was taken, what happened that day, or why the moment mattered?
            </p>
            <div className="lm-question-list" aria-label="Questions a photograph cannot answer by itself">
              <span>Who are they?</span>
              <span>Where was this?</span>
              <span>What happened next?</span>
              <span>Why did this day matter?</span>
            </div>
          </div>
          <StoryPhoto variant="porch" caption="The photo remains. The details can disappear." />
        </div>
      </section>

      <section className="lm-section lm-section-soft" aria-labelledby="stakes-title">
        <div className="lm-section-inner lm-editorial-narrow">
          <p className="lm-eyebrow">What can be lost</p>
          <h2 id="stakes-title">The photo can remain after the details are gone.</h2>
          <p className="lm-large-copy">
            Names get forgotten. Places become guesses. Family jokes lose their meaning. A handwritten note may say a year but not what the day felt like. The person's own way of telling the story can disappear completely.
          </p>
        </div>
      </section>

      <section className="lm-section" aria-labelledby="future-title">
        <div className="lm-section-inner lm-split lm-split-reverse">
          <StoryPhoto variant="mother-daughter" caption="A story can be heard again years later." />
          <div className="lm-copy-column">
            <p className="lm-eyebrow">The future you can preserve</p>
            <h2 id="future-title">Imagine your family hearing the story years from now.</h2>
            <p className="lm-body-copy">
              A daughter opens a photograph and hears her mother's voice explain who was there. A grandchild hears why a house mattered. A family member in another country adds the detail everyone else forgot.
            </p>
            <p className="lm-body-copy">
              The photograph is no longer just something to look at. It has a voice and a story attached to it.
            </p>
          </div>
        </div>
      </section>

      <section className="lm-section lm-proof-section" aria-labelledby="proof-title">
        <div className="lm-section-inner">
          <div className="lm-editorial-narrow lm-center-copy">
            <p className="lm-eyebrow">Why this idea makes sense</p>
            <h2 id="proof-title">The idea is emotional. It also has a practical foundation.</h2>
            <p className="lm-body-copy">
              We do not have enough customer stories yet to pretend otherwise. For now, we separate what you can see in the product from what outside research supports.
            </p>
          </div>
          <div className="lm-proof-demo" aria-label="Living Memory demonstration">
            <div>
              <span className="lm-proof-label">Photo alone</span>
              <StoryPhoto variant="family" caption="What happened?" compact />
            </div>
            <span className="lm-proof-arrow" aria-hidden="true">→</span>
            <div>
              <span className="lm-proof-label">Photo + real voice + story</span>
              <StoryPhoto variant="family" caption="Now the moment has context." compact alive />
            </div>
          </div>
          <div className="lm-proof-list">
            <ProofBlock
              title="Pictures can help bring personal memories back."
              body="Research on personal memory has found that pictures and visual cues can affect what people remember and how they remember it."
              href={proofLinks.pictures}
            />
            <ProofBlock
              title="A voice carries more than words."
              body="A person's voice can carry identity and feeling that a written transcript cannot fully preserve."
              href={proofLinks.voice}
            />
            <ProofBlock
              title="Families often remember by talking together."
              body="People may remember different parts of the same event. Talking together can bring out details one person would not remember alone."
              href={proofLinks.together}
            />
          </div>
          <p className="lm-proof-integrity">
            These sources support the idea behind Living Memories. They do not prove that MemoriesMyStory improves memory, health, relationships, or well-being.
          </p>
        </div>
      </section>

      <FreeInvitation
        eyebrow="After the proof"
        title="See what happens with one of your own photographs."
        body="You do not have to decide whether the whole idea is right for your family. Start with one photograph and hear the difference yourself."
        placement="post_proof"
        button="Give One Photo Its Voice — Free"
      />

      <section className="lm-section" id="how-it-works" aria-labelledby="how-title">
        <div className="lm-section-inner">
          <div className="lm-editorial-narrow lm-center-copy">
            <p className="lm-eyebrow">How it works</p>
            <h2 id="how-title">Turn a photograph into a Living Memory.</h2>
            <p className="lm-body-copy">
              You choose the photo. You tell the story. Muse helps when you need it. MemoriesMyStory keeps the original photo and voice together with the details that help your family understand the moment later.
            </p>
          </div>
          <div className="lm-mechanism-row" aria-label="Photo, voice, Muse, Living Memory">
            <MechanismStep number="1" title="Photo" body="Pick a photograph that means something to you." />
            <MechanismStep number="2" title="Voice" body="Tell the story in your own words." />
            <MechanismStep number="3" title="Muse" body="Get help with the useful details." />
            <MechanismStep number="4" title="Living Memory" body="Hear the photo and story together again." />
          </div>
        </div>
      </section>

      <section className="lm-section lm-section-soft" aria-labelledby="ease-title">
        <div className="lm-section-inner lm-split">
          <div className="lm-copy-column">
            <p className="lm-eyebrow">Made to feel simple</p>
            <h2 id="ease-title">You do not need to write a memoir.</h2>
            <p className="lm-body-copy">
              Pick a photograph and talk. No script. No blank page. No need to remember every date before you begin.
            </p>
            <ol className="lm-numbered-steps">
              <li><strong>Pick a photograph.</strong><span>Choose one that brings something back.</span></li>
              <li><strong>Tell the story.</strong><span>Speak naturally, the way you would to family.</span></li>
              <li><strong>Muse helps.</strong><span>It can transcribe and ask one useful question.</span></li>
              <li><strong>Hear it again.</strong><span>See the photo with the voice and story together.</span></li>
            </ol>
          </div>
          <div className="lm-muse-device" aria-label="Muse preview">
            <span className="lm-device-label">Muse</span>
            <p>“You mentioned your uncle was there. Do you remember who took the photo?”</p>
            <span className="lm-device-status">Listening when you want help</span>
          </div>
        </div>
      </section>

      <section className="lm-section lm-muse-trust" aria-labelledby="muse-title">
        <div className="lm-section-inner lm-editorial-narrow">
          <p className="lm-eyebrow">AI has a supporting role</p>
          <h2 id="muse-title">You remember. Muse helps.</h2>
          <div className="lm-feature-columns">
            <p>Turns your spoken story into readable words.</p>
            <p>Helps notice missing names, places, or dates.</p>
            <p>Asks a thoughtful follow-up question when useful.</p>
            <p>Helps keep related memories organized.</p>
          </div>
          <div className="lm-trust-callout">
            <strong>Muse never invents your memory.</strong>
            <span>The photograph and the person's real voice remain the source.</span>
          </div>
        </div>
      </section>

      <FreeInvitation
        eyebrow="No writing assignment"
        title="Pick a photograph and talk."
        body="Start with one story. Muse can help with the rest. Preserve more only when you are ready."
        placement="post_muse"
        button="Start With One Living Memory — Free"
      />

      <section className="lm-section lm-memory-circle" id="memory-circle" aria-labelledby="circle-title">
        <div className="lm-section-inner lm-circle-grid">
          <div className="lm-copy-column">
            <p className="lm-eyebrow">Memory Circle</p>
            <h2 id="circle-title">Some stories are better remembered together.</h2>
            <p className="lm-body-copy">
              Sit together at the kitchen table—or join from across the country. Put one photograph in the middle and share the moment of telling its story.
            </p>
            <p className="lm-body-copy">
              One person remembers the place. Someone else remembers the year. A sister recognizes an uncle. A daughter asks the question no one thought to ask.
            </p>
            <div className="lm-circle-points">
              <span>Hear the story together.</span>
              <span>Add what someone else remembers.</span>
              <span>Keep each person's memory with their name.</span>
              <span>Preserve the questions, laughter, and reactions when everyone agrees to record.</span>
            </div>
            <p className="lm-offer-note">Live Memory Circle is included with Life and Family.</p>
          </div>
          <MemoryCircleVisual />
        </div>
      </section>

      <section className="lm-section" id="privacy" aria-labelledby="privacy-title">
        <div className="lm-section-inner lm-editorial-narrow lm-center-copy">
          <p className="lm-eyebrow">Privacy</p>
          <h2 id="privacy-title">Private first. Shared when you choose.</h2>
          <p className="lm-body-copy">
            A Living Memory starts under your control. Keep it private. Invite family. Send one memory to a friend. Share a selected copy to Facebook when you want to.
          </p>
          <div className="lm-privacy-path" aria-label="Sharing choices">
            <span>Private</span><span>Family</span><span>Friend</span><span>Facebook</span>
          </div>
          <p className="lm-trust-line">Sharing one memory does not make your private Family Archive public.</p>
        </div>
      </section>

      <section className="lm-section lm-section-soft" aria-labelledby="sharing-title">
        <div className="lm-section-inner lm-split">
          <StoryPhoto variant="friends" caption="A story worth sharing can travel on its own." />
          <div className="lm-copy-column">
            <p className="lm-eyebrow">Share by choice</p>
            <h2 id="sharing-title">Some stories are meant to be passed along.</h2>
            <p className="lm-body-copy">
              Families have always shown photographs, told the story, and passed that story from person to person. MemoriesMyStory makes that natural behavior easier online.
            </p>
            <p className="lm-body-copy">
              When you choose to share, the shared copy can include the photograph, a voice clip, captions, and the story you selected. Your private archive stays separate.
            </p>
          </div>
        </div>
      </section>

      <section className="lm-section lm-growth" aria-labelledby="growth-title">
        <div className="lm-section-inner">
          <div className="lm-editorial-narrow lm-center-copy">
            <p className="lm-eyebrow">Start small. Grow with the family.</p>
            <h2 id="growth-title">Start with one moment. Build from there.</h2>
          </div>
          <div className="lm-growth-grid">
            <GrowthStage title="Moment" body="One photograph. One voice. One story." />
            <GrowthStage title="Chapter" body="A meaningful part of someone's life." />
            <GrowthStage title="Life" body="The stories and Chapters that help a family understand one person." />
            <GrowthStage title="Family" body="A connected archive across people, relationships, and generations." />
          </div>
        </div>
      </section>

      <section className="lm-section lm-section-dark" aria-labelledby="contains-title">
        <div className="lm-section-inner lm-split">
          <div className="lm-copy-column lm-copy-light">
            <p className="lm-eyebrow">What a Living Memory can hold</p>
            <h2 id="contains-title">More than a recording. More than a photo album.</h2>
            <p className="lm-body-copy">
              The value is not one file. It is keeping the parts of the story connected so your family can understand it later.
            </p>
          </div>
          <div className="lm-value-list">
            <span>The original photograph</span>
            <span>The person's real voice</span>
            <span>A readable transcript</span>
            <span>Names, places, and dates you choose to add</span>
            <span>Family contributions</span>
            <span>A private place to find the memory again</span>
          </div>
        </div>
      </section>

      <section className="lm-section" aria-labelledby="difference-title">
        <div className="lm-section-inner lm-editorial-narrow">
          <p className="lm-eyebrow">Why MemoriesMyStory is different</p>
          <h2 id="difference-title">The story stays connected to the person who told it.</h2>
          <div className="lm-difference-list">
            <p><strong>A photo library</strong> keeps pictures.</p>
            <p><strong>A transcription service</strong> turns speech into text.</p>
            <p><strong>A memory book</strong> can turn stories into pages.</p>
            <p><strong>MemoriesMyStory</strong> is built to keep the photograph, real voice, story, family context, and future contributions connected as a Living Memory.</p>
          </div>
          <p className="lm-trust-line">AI helps with the work. It does not become the author of your family's memory.</p>
        </div>
      </section>

      <section className="lm-section lm-memorial" aria-labelledby="memorial-title">
        <div className="lm-section-inner lm-editorial-narrow lm-center-copy">
          <p className="lm-eyebrow">A larger reason to preserve</p>
          <h2 id="memorial-title">We have always found ways to remember the people we love.</h2>
          <p className="lm-large-copy">
            Photographs can preserve faces. Traditional memorials can preserve names and dates. A Living Memory can preserve more of the life between the dates: the person's voice, the story, the relationships, and the way the family remembers together.
          </p>
          <p className="lm-memorial-line">Preserve more of the life between the dates.</p>
        </div>
      </section>

      <FreeInvitation
        eyebrow="Before you choose a plan"
        title="Experience one Living Memory first."
        body="Create one complete Living Memory free. Hear your own photograph with its story before deciding whether you want to preserve a Chapter, a Life, or a larger Family Archive."
        placement="pre_pricing"
        button="Create Your First Living Memory Free"
        secondary={{ href: "#pricing", label: "Compare Ways to Preserve More" }}
      />

      <section className="lm-section lm-pricing" id="pricing" aria-labelledby="pricing-title">
        <div className="lm-section-inner">
          <div className="lm-editorial-narrow lm-center-copy">
            <p className="lm-eyebrow">Preserve more when you are ready</p>
            <h2 id="pricing-title">Choose how much of the story you want to preserve.</h2>
            <p className="lm-body-copy">
              The first Living Memory is free. Paid plans increase the amount of family history you can keep together.
            </p>
          </div>
          <div className="lm-offer-grid">
            {(["chapter", "life", "family"] as OfferId[]).map((offerId) => (
              <OfferCard key={offerId} offerId={offerId} />
            ))}
          </div>
        </div>
      </section>

      <section className="lm-section lm-section-soft" aria-labelledby="hard-parts-title">
        <div className="lm-section-inner">
          <div className="lm-editorial-narrow lm-center-copy">
            <p className="lm-eyebrow">The value stack</p>
            <h2 id="hard-parts-title">We remove the hard parts so you can tell the story.</h2>
          </div>
          <div className="lm-objection-grid">
            <Objection thought="I don't know what to say." answer="Muse can give you a useful question to start or keep going." />
            <Objection thought="I don't want to write all this." answer="Tell the story in your voice. Transcription is part of the experience." />
            <Objection thought="I don't remember the exact date." answer="You can say you are unsure. MemoriesMyStory should not invent certainty." />
            <Objection thought="My sister remembers more than I do." answer="Invite her to add what she remembers." />
            <Objection thought="We remember it differently." answer="Both memories can stay with the name of the person who told them." />
            <Objection thought="I'm not good with technology." answer="Start with a photo and talk. The software handles the structure behind the scenes." />
          </div>
        </div>
      </section>

      <section className="lm-section" aria-labelledby="future-proof-title">
        <div className="lm-section-inner lm-editorial-narrow lm-center-copy">
          <p className="lm-eyebrow">Proof should become more direct over time</p>
          <h2 id="future-proof-title">The next proof should come from real families.</h2>
          <p className="lm-body-copy">
            Until permissioned customer stories exist, we use product demonstrations, honest research, and tested product behavior. As real families use MemoriesMyStory, their permissioned examples should replace borrowed proof.
          </p>
        </div>
      </section>

      <section className="lm-section lm-trust-section" id="trust" aria-labelledby="trust-title">
        <div className="lm-section-inner lm-split">
          <div className="lm-copy-column">
            <p className="lm-eyebrow">Trust</p>
            <h2 id="trust-title">Your original photo and voice stay yours.</h2>
            <p className="lm-body-copy">
              The original photograph and real human voice are never silently replaced by an AI-made version.
            </p>
          </div>
          <div className="lm-trust-list">
            <span>Private by default</span>
            <span>You choose what to share</span>
            <span>Originals are preserved</span>
            <span>Uncertain details can stay uncertain</span>
            <span>Family contributions stay connected to who said them</span>
          </div>
        </div>
      </section>

      <section className="lm-section lm-faq" id="faq" aria-labelledby="faq-title">
        <div className="lm-section-inner lm-editorial-wide">
          <p className="lm-eyebrow">Common questions</p>
          <h2 id="faq-title">Questions families ask before they begin.</h2>
          <div className="lm-faq-list">
            <Faq question="Is my first Living Memory really free?" answer="Yes. The current offer is one complete Living Memory free so you can experience the idea before deciding whether to preserve more." />
            <Faq question="Do I need a credit card to create it?" answer="No. The free Magic Moment does not require a credit card." />
            <Faq question="How much can I record?" answer="The current offer target is up to 10 minutes of source voice for each Living Memory. We will validate the final limit against real operating costs before public launch." />
            <Faq question="Does Muse write or invent my memories?" answer="No. Muse can transcribe, organize, and ask helpful questions. Your photo, voice, and human corrections remain the source." />
            <Faq question="Can I keep everything private?" answer="Yes. Living Memories start private. You decide what stays private and what you choose to share." />
            <Faq question="Can family members add their own memories?" answer="Yes. Family contributions are part of the product direction, with richer collaboration in Life and Family." />
            <Faq question="What is Memory Circle?" answer="Memory Circle is a shared remembrance around one photograph. People can sit together or join from different places and add what they remember." />
            <Faq question="What if two people remember the same event differently?" answer="Both memories can stay. MemoriesMyStory should not turn honest differences into a false single answer." />
            <Faq question="Can I export my family's memories?" answer="Export is part of the product doctrine. Public paid claims will only promise the exact formats and behavior once fulfillment is tested." />
          </div>
        </div>
      </section>

      <section className="lm-section lm-final-cta" aria-labelledby="final-title">
        <div className="lm-section-inner lm-final-grid">
          <StoryPhoto variant="sisters" caption="Which photograph would you choose?" />
          <div className="lm-copy-column">
            <p className="lm-eyebrow">Start with one photograph</p>
            <h2 id="final-title">You probably already know which photograph you would choose.</h2>
            <p className="lm-final-line">Your voice turns it into a Living Memory.</p>
            <p className="lm-body-copy">
              Pick that photograph. Tell the story the way you remember it. Let your family hear more than what the moment looked like.
            </p>
            <FreeMemoryLink placement="final">Create Your First Living Memory</FreeMemoryLink>
            <p className="lm-trust-line">One complete Living Memory free. No credit card required. Preserve more only when you are ready.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

function FreeMemoryLink({ children, placement }: { readonly children: React.ReactNode; readonly placement: string }) {
  return (
    <Link className="lm-primary-button" to={`/auth/protect?intent=free&from=${encodeURIComponent(placement)}`}>
      {children}
    </Link>
  );
}

function FreeInvitation({
  eyebrow,
  title,
  body,
  placement,
  button,
  note,
  secondary
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
  readonly placement: string;
  readonly button: string;
  readonly note?: string;
  readonly secondary?: { href: string; label: string };
}) {
  return (
    <section className="lm-section lm-free-invitation" aria-label={title}>
      <div className="lm-section-inner lm-editorial-narrow lm-center-copy">
        <p className="lm-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p className="lm-body-copy">{body}</p>
        <div className="lm-action-row lm-action-row-center">
          <FreeMemoryLink placement={placement}>{button}</FreeMemoryLink>
          {secondary && <a className="lm-secondary-button" href={secondary.href}>{secondary.label}</a>}
        </div>
        {note && <p className="lm-trust-line">{note}</p>}
      </div>
    </section>
  );
}

function ProofBlock({ title, body, href }: { readonly title: string; readonly body: string; readonly href: string }) {
  return (
    <article className="lm-proof-block">
      <span className="lm-proof-icon" aria-hidden="true">✦</span>
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
        <a href={href} target="_blank" rel="noreferrer">See the research</a>
      </div>
    </article>
  );
}

function MechanismStep({ number, title, body }: { readonly number: string; readonly title: string; readonly body: string }) {
  return (
    <article className="lm-mechanism-step">
      <span>{number}</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

function GrowthStage({ title, body }: { readonly title: string; readonly body: string }) {
  return (
    <article className="lm-growth-stage">
      <div className="lm-growth-photo" aria-hidden="true" />
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

function OfferCard({ offerId }: { readonly offerId: OfferId }) {
  const offer = livingMemoryOffers[offerId];
  return (
    <article className={`lm-offer-card ${offerId === "life" ? "is-emphasized" : ""}`}>
      <p className="lm-offer-name">{offer.name}</p>
      <h3>{offer.outcome}</h3>
      <div className="lm-price-row">
        <strong>{offer.priceLabel}</strong>
        <span>one-time</span>
      </div>
      <p>{offer.shortDescription}</p>
      <ul>
        {offer.primaryBenefits.map((benefit) => <li key={benefit}>{benefit}</li>)}
      </ul>
      <details>
        <summary>See everything included</summary>
        <ul>
          {offer.expandedBenefits.map((benefit) => <li key={benefit}>{benefit}</li>)}
        </ul>
      </details>
      <Link className="lm-primary-button lm-offer-button" to={`/auth/protect?intent=checkout&offer=${offer.id}`}>
        {offerId === "chapter" ? "Preserve a Chapter" : offerId === "life" ? "Preserve a Life" : "Build the Family Archive"}
      </Link>
    </article>
  );
}

function Objection({ thought, answer }: { readonly thought: string; readonly answer: string }) {
  return (
    <article className="lm-objection">
      <h3>“{thought}”</h3>
      <p>{answer}</p>
    </article>
  );
}

function Faq({ question, answer }: { readonly question: string; readonly answer: string }) {
  return (
    <details className="lm-faq-item">
      <summary>{question}</summary>
      <p>{answer}</p>
    </details>
  );
}

function VoiceWave() {
  const bars = [14, 20, 30, 18, 38, 25, 16, 32, 21, 42, 26, 18, 34, 23, 15, 28, 20];
  return (
    <span className="lm-voice-wave" aria-hidden="true">
      {bars.map((height, index) => <span key={`${height}-${index}`} style={{ height }} />)}
    </span>
  );
}

function StoryPhoto({
  variant,
  caption,
  dark = false,
  compact = false,
  alive = false
}: {
  readonly variant: "sisters" | "family" | "porch" | "mother-daughter" | "friends";
  readonly caption: string;
  readonly dark?: boolean;
  readonly compact?: boolean;
  readonly alive?: boolean;
}) {
  return (
    <figure className={`lm-story-photo lm-photo-${variant} ${dark ? "is-dark" : ""} ${compact ? "is-compact" : ""} ${alive ? "is-alive" : ""}`}>
      <div className="lm-photo-art" aria-hidden="true">
        <span className="lm-photo-person person-one" />
        <span className="lm-photo-person person-two" />
        <span className="lm-photo-person person-three" />
        <span className="lm-photo-person person-four" />
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function MemoryCircleVisual() {
  return (
    <div className="lm-circle-visual" aria-label="Family gathered around one photograph">
      <StoryPhoto variant="family" caption="The photograph stays at the center." compact alive />
      <div className="lm-circle-people" aria-hidden="true">
        <span>Mom</span><span>Elena</span><span>David</span><span>Sofia</span>
      </div>
      <p>At the kitchen table. Across the country. Across generations.</p>
    </div>
  );
}
