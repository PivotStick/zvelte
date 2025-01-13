<script>
    let { form } = $props();

    /** @type {any} */
    let errors;

    function submit() {}
    function visit(key = "") {}
</script>

<div class="content-container">
	<div class="background"></div>

	<h2 class="centered light">Contact us</h2>
	<div class="form">
		<div class="input" data-error={ errors?.name }>
			<label for="name__input">Your Name*</label>
			<input
				type="text"
				id="name__input"
				name="name"
				autocomplete="fullname"
				placeholder="Enter your name"
				required
				on:blur={ () => visit('name') }
				bind:value={ form.name }
			/>
		</div>

		<div class="input" data-error={ errors?.email }>
			<label for="email__input">Your Email*</label>
			<input
				type="email"
				id="email__input"
				name="email"
				autocomplete="email"
				placeholder="Enter your email"
				required
				on:blur={ () => visit('email') }
				bind:value={ form.email }
			/>
		</div>

		<div class="input" data-error={ errors?.company }>
			<label for="company__input">Company</label>
			<input
				type="text"
				id="company__input"
				name="company"
				autocomplete="company"
				placeholder="Company name"
				on:blur={ () => visit('company') }
				bind:value={ form.company }
			/>
		</div>

		<div class="input" data-error={ errors?.message }>
			<label for="message__input">Leave us a message*</label>
			<textarea
				id="message__input"
				name="message"
				autocomplete="company"
				placeholder="Write your message"
				required
				on:blur={ () => visit('message') }
				bind:value={ form.message }
			></textarea>
		</div>

		<button class="btn" on:click={ submit } disabled={ errors }>Send Message</button>
	</div>

	<div class="contact-links">
		<div class="link">
			<div class="icon">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 31 30" fill="none">
					<path opacity="0.2" d="M26.4985 6.5625L15.2485 16.875L3.99854 6.5625H26.4985Z" fill="#F6F7F9"></path>
					<path d="M26.4985 5.625H3.99854C3.74989 5.625 3.51144 5.72377 3.33562 5.89959C3.15981 6.0754 3.06104 6.31386 3.06104 6.5625V22.5C3.06104 22.9973 3.25858 23.4742 3.61021 23.8258C3.96184 24.1775 4.43875 24.375 4.93604 24.375H25.561C26.0583 24.375 26.5352 24.1775 26.8869 23.8258C27.2385 23.4742 27.436 22.9973 27.436 22.5V6.5625C27.436 6.31386 27.3373 6.0754 27.1614 5.89959C26.9856 5.72377 26.7472 5.625 26.4985 5.625ZM24.088 7.5L15.2485 15.6035L6.40908 7.5H24.088ZM25.561 22.5H4.93604V8.69414L14.6146 17.5664C14.7875 17.7252 15.0138 17.8133 15.2485 17.8133C15.4833 17.8133 15.7096 17.7252 15.8825 17.5664L25.561 8.69414V22.5Z" fill="currentColor"></path>
				</svg>
			</div>

			<p class="title">Send us email</p>
			<a class="coordinate" href="mailto:sales@encaps.io">sales@encaps.io</a>
		</div>

		<div class="link">
			<div class="icon">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 31 30" fill="none">
					<path opacity="0.2" d="M15.4868 2.8125C13.0004 2.8125 10.6158 3.80022 8.85769 5.55837C7.09954 7.31653 6.11182 9.7011 6.11182 12.1875C6.11182 20.625 15.4868 27.1875 15.4868 27.1875C15.4868 27.1875 24.8618 20.625 24.8618 12.1875C24.8618 9.7011 23.8741 7.31653 22.1159 5.55837C20.3578 3.80022 17.9732 2.8125 15.4868 2.8125ZM15.4868 15.9375C14.7451 15.9375 14.0201 15.7176 13.4034 15.3055C12.7867 14.8935 12.3061 14.3078 12.0223 13.6226C11.7384 12.9373 11.6642 12.1833 11.8089 11.4559C11.9536 10.7285 12.3107 10.0603 12.8352 9.53585C13.3596 9.0114 14.0278 8.65425 14.7552 8.50955C15.4827 8.36486 16.2367 8.43912 16.9219 8.72295C17.6071 9.00678 18.1928 9.48743 18.6048 10.1041C19.0169 10.7208 19.2368 11.4458 19.2368 12.1875C19.2368 13.1821 18.8417 14.1359 18.1385 14.8392C17.4352 15.5424 16.4814 15.9375 15.4868 15.9375Z" fill="currentColor"></path>
					<path d="M15.4868 7.5C14.5597 7.5 13.6534 7.77492 12.8826 8.28999C12.1117 8.80506 11.5109 9.53714 11.1561 10.3937C10.8013 11.2502 10.7085 12.1927 10.8894 13.102C11.0703 14.0113 11.5167 14.8465 12.1723 15.5021C12.8278 16.1576 13.663 16.6041 14.5723 16.7849C15.4816 16.9658 16.4241 16.873 17.2806 16.5182C18.1372 16.1634 18.8693 15.5626 19.3843 14.7917C19.8994 14.0209 20.1743 13.1146 20.1743 12.1875C20.1743 10.9443 19.6805 9.75201 18.8014 8.87294C17.9223 7.99386 16.73 7.5 15.4868 7.5ZM15.4868 15C14.9306 15 14.3868 14.835 13.9243 14.526C13.4618 14.217 13.1013 13.7777 12.8884 13.2638C12.6755 12.7499 12.6198 12.1844 12.7284 11.6388C12.8369 11.0932 13.1047 10.5921 13.4981 10.1988C13.8914 9.80543 14.3926 9.53756 14.9381 9.42904C15.4837 9.32052 16.0492 9.37622 16.5631 9.58909C17.077 9.80196 17.5163 10.1624 17.8253 10.625C18.1344 11.0875 18.2993 11.6312 18.2993 12.1875C18.2993 12.9334 18.003 13.6488 17.4756 14.1762C16.9481 14.7037 16.2327 15 15.4868 15ZM15.4868 1.875C12.7527 1.8781 10.1315 2.96559 8.1982 4.89889C6.26491 6.83218 5.17742 9.45341 5.17432 12.1875C5.17432 15.8672 6.87471 19.7672 10.0962 23.4668C11.5437 25.1385 13.1729 26.6439 14.9536 27.9551C15.1112 28.0655 15.299 28.1247 15.4915 28.1247C15.684 28.1247 15.8718 28.0655 16.0294 27.9551C17.8068 26.6434 19.4328 25.138 20.8774 23.4668C24.0942 19.7672 25.7993 15.8672 25.7993 12.1875C25.7962 9.45341 24.7087 6.83218 22.7754 4.89889C20.8421 2.96559 18.2209 1.8781 15.4868 1.875ZM15.4868 26.0156C13.5497 24.4922 7.04932 18.8965 7.04932 12.1875C7.04932 9.94974 7.93826 7.80362 9.5206 6.22129C11.1029 4.63895 13.2491 3.75 15.4868 3.75C17.7246 3.75 19.8707 4.63895 21.453 6.22129C23.0354 7.80362 23.9243 9.94974 23.9243 12.1875C23.9243 18.8941 17.4239 24.4922 15.4868 26.0156Z" fill="currentColor"></path>
				</svg>
			</div>

			<p class="title">Office location</p>
			<p>Montpellier, France</p>
		</div>
	</div>
</div>
